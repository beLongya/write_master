import base64
import html
import json
import mimetypes
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT = pathlib.Path(__file__).resolve().parent
TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
HANDWRITING_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting"


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/":
            path = "/index.html"
        target = (ROOT / path.lstrip("/")).resolve()
        if not str(target).startswith(str(ROOT)) or not target.exists() or target.is_dir():
            self.send_error(404)
            return

        data = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/api/ocr/handwriting":
                files = self.read_multipart_files("image")
                if not files:
                    raise AppError(400, "没有找到名为 image 的上传字段。")
                self.send_json(200, recognize_handwriting(files[0]["data"]))
                return

            if path == "/api/document/extract":
                files = self.read_multipart_files("document")
                if not files:
                    raise AppError(400, "没有找到名为 document 的上传字段。")
                self.send_json(200, extract_document(files[0]["filename"], files[0]["data"]))
                return

            if path == "/api/batch/extract":
                files = self.read_multipart_files("documents")
                if not files:
                    raise AppError(400, "没有找到名为 documents 的上传字段。")
                documents = [extract_document(item["filename"], item["data"]) for item in files]
                self.send_json(200, {"documents": documents})
                return

            self.send_error(404)
        except AppError as error:
            self.send_json(error.status, {"error": str(error)})
        except Exception as error:
            self.send_json(500, {"error": f"服务异常：{error}"})

    def read_multipart_files(self, field_name):
        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        boundary_match = re.search(r"boundary=([^;]+)", content_type)
        if not boundary_match:
            raise AppError(400, "请求必须使用 multipart/form-data 上传文件。")

        boundary = boundary_match.group(1).strip().strip('"').encode()
        results = []
        for part in body.split(b"--" + boundary):
            if b"\r\n\r\n" not in part:
                continue
            headers_raw, data = part.split(b"\r\n\r\n", 1)
            headers = headers_raw.decode("utf-8", errors="ignore")
            if f'name="{field_name}"' not in headers:
                continue
            filename_match = re.search(r'filename="([^"]*)"', headers)
            filename = filename_match.group(1) if filename_match else "upload"
            if data.endswith(b"\r\n"):
                data = data[:-2]
            if data.endswith(b"--"):
                data = data[:-2]
            if data.startswith(b"\r\n"):
                data = data[2:]
            if data.endswith(b"\r\n"):
                data = data[:-2]
            if not data:
                continue
            if len(data) > 12 * 1024 * 1024:
                raise AppError(413, "单个文件过大，请压缩到 12MB 以内。")
            results.append({"filename": filename, "data": data})
        return results

    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class AppError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def recognize_handwriting(image_bytes):
    api_key = os.environ.get("BAIDU_OCR_API_KEY")
    secret_key = os.environ.get("BAIDU_OCR_SECRET_KEY")
    if not api_key or not secret_key:
        raise AppError(500, "缺少 BAIDU_OCR_API_KEY 或 BAIDU_OCR_SECRET_KEY 环境变量。")

    token = get_access_token(api_key, secret_key)
    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    params = urllib.parse.urlencode({"image": image_base64}).encode("utf-8")
    url = f"{HANDWRITING_URL}?access_token={urllib.parse.quote(token)}"
    request = urllib.request.Request(url, data=params, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        raise AppError(502, f"OCR 网络请求失败：{error}") from error

    if "error_code" in payload:
        raise AppError(502, f"百度 OCR 返回错误 {payload.get('error_code')}：{payload.get('error_msg')}")

    blocks = []
    for item in payload.get("words_result", []):
        location = item.get("location") or {}
        blocks.append(
            {
                "words": item.get("words", ""),
                "location": {
                    "left": location.get("left", 0),
                    "top": location.get("top", 0),
                    "width": location.get("width", 0),
                    "height": location.get("height", 0),
                },
            }
        )

    return {
        "text": "\n".join(block["words"] for block in blocks if block["words"]),
        "blocks": blocks,
    }


def get_access_token(api_key, secret_key):
    params = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": api_key,
            "client_secret": secret_key,
        }
    )
    try:
        with urllib.request.urlopen(f"{TOKEN_URL}?{params}", timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        raise AppError(502, f"获取百度 access token 失败：{error}") from error

    token = payload.get("access_token")
    if not token:
        raise AppError(502, f"百度 token 响应异常：{payload}")
    return token


def extract_document(filename, data):
    suffix = pathlib.Path(filename).suffix.lower()
    if suffix == ".docx":
        text = extract_docx_text(data)
    elif suffix == ".pdf":
        text = extract_pdf_text(data)
    else:
        raise AppError(400, f"暂不支持 {suffix or '未知'} 文件，请上传 .docx 或 .pdf。")

    text = normalize_text(text)
    return {
        "filename": filename,
        "text": text,
        "pages": split_pages(text),
    }


def extract_docx_text(data):
    try:
        with zipfile.ZipFile(bytes_to_filelike(data)) as docx:
            xml_bytes = docx.read("word/document.xml")
    except Exception as error:
        raise AppError(400, f"Word 文档读取失败：{error}") from error

    root = ET.fromstring(xml_bytes)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespace):
        chunks = []
        for node in paragraph.findall(".//w:t", namespace):
            if node.text:
                chunks.append(node.text)
        text = "".join(chunks).strip()
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def extract_pdf_text(data):
    temp_path = ROOT / "_tmp_upload.pdf"
    temp_path.write_bytes(data)
    try:
        try:
            from pypdf import PdfReader
        except Exception:
            try:
                from PyPDF2 import PdfReader
            except Exception as error:
                raise AppError(500, "当前 Python 环境没有可用的 pypdf/PyPDF2，无法提取 PDF 文本。") from error

        reader = PdfReader(str(temp_path))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n\n".join(pages)
    finally:
        try:
            temp_path.unlink()
        except OSError:
            pass


def normalize_text(text):
    text = html.unescape(text or "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_pages(text, size=620):
    text = (text or "").strip()
    if not text:
        return []
    pages = []
    buffer = ""
    for paragraph in re.split(r"\n+", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if buffer and len(buffer) + len(paragraph) + 1 > size:
            pages.append(buffer)
            buffer = paragraph
        else:
            buffer = f"{buffer}\n{paragraph}".strip() if buffer else paragraph
    if buffer:
        pages.append(buffer)
    return pages


def bytes_to_filelike(data):
    import io

    return io.BytesIO(data)


def main():
    port = int(os.environ.get("PORT", "8787"))
    server = ThreadingHTTPServer(("127.0.0.1", port), AppHandler)
    print(f"Serving http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)

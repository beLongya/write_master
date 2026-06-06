(function () {
  "use strict";

  const LIBRARY_KEY = "personal-handwriting-library-v3";
  const LEGACY_KEY = "personal-handwriting-glyphs-v2";
  const COMMON_CHARS = "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联";
  const DEFAULT_STYLES = [
    { id: "neat", name: "工整版", glyphs: [] },
    { id: "daily", name: "日常版", glyphs: [] },
    { id: "practice", name: "练习版", glyphs: [] }
  ];
  const PEN_PRESETS = {
    blackGel: { color: "#111111", alpha: 0.95, stroke: 1.0, name: "黑色中性笔" },
    blueBall: { color: "#174a8b", alpha: 0.86, stroke: 0.85, name: "蓝色圆珠笔" },
    fountain: { color: "#1f2a3d", alpha: 0.9, stroke: 1.25, name: "钢笔风格" }
  };

  const state = {
    sampleFile: null,
    sampleImage: null,
    imageScale: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
    blocks: [],
    candidates: [],
    selection: null,
    isDragging: false,
    dragStart: null,
    library: loadLibrary(),
    documents: [],
    customPaperImage: null,
    customPaperName: "",
    regionMode: false,
    regionSelection: null,
    isRegionDragging: false,
    regionDragStart: null,
    seed: Math.floor(Math.random() * 1000000)
  };

  const $ = (id) => document.getElementById(id);
  const sampleCanvas = $("sampleCanvas");
  const sampleCtx = sampleCanvas.getContext("2d");
  const previewCanvas = $("previewCanvas");
  const previewCtx = previewCanvas.getContext("2d");

  const controls = {
    sampleInput: $("sampleInput"),
    emptySample: $("emptySample"),
    ocrBtn: $("ocrBtn"),
    buildCandidatesBtn: $("buildCandidatesBtn"),
    acceptCandidatesBtn: $("acceptCandidatesBtn"),
    clearCandidatesBtn: $("clearCandidatesBtn"),
    ocrText: $("ocrText"),
    recognitionStatus: $("recognitionStatus"),
    blockCount: $("blockCount"),
    blockList: $("blockList"),
    candidateGrid: $("candidateGrid"),
    glyphChar: $("glyphChar"),
    addGlyphBtn: $("addGlyphBtn"),
    clearSelectionBtn: $("clearSelectionBtn"),
    styleSelect: $("styleSelect"),
    styleName: $("styleName"),
    addStyleBtn: $("addStyleBtn"),
    deleteStyleBtn: $("deleteStyleBtn"),
    clearLibraryBtn: $("clearLibraryBtn"),
    glyphCount: $("glyphCount"),
    sampleCount: $("sampleCount"),
    coverageRate: $("coverageRate"),
    missingChars: $("missingChars"),
    practiceText: $("practiceText"),
    copyPracticeBtn: $("copyPracticeBtn"),
    libraryGrid: $("libraryGrid"),
    textInput: $("textInput"),
    paperType: $("paperType"),
    customPaperInput: $("customPaperInput"),
    penType: $("penType"),
    fontSize: $("fontSize"),
    lineHeight: $("lineHeight"),
    letterGap: $("letterGap"),
    jitter: $("jitter"),
    photoReal: $("photoReal"),
    tilt: $("tilt"),
    renderBtn: $("renderBtn"),
    randomizeBtn: $("randomizeBtn"),
    regionModeBtn: $("regionModeBtn"),
    resetRegionBtn: $("resetRegionBtn"),
    regionStatus: $("regionStatus"),
    downloadPngBtn: $("downloadPngBtn"),
    downloadJpgBtn: $("downloadJpgBtn"),
    documentInput: $("documentInput"),
    extractDocsBtn: $("extractDocsBtn"),
    downloadBatchBtn: $("downloadBatchBtn"),
    documentStatus: $("documentStatus"),
    documentTasks: $("documentTasks")
  };

  const outputs = {
    fontSize: $("fontSizeOut"),
    lineHeight: $("lineHeightOut"),
    letterGap: $("letterGapOut"),
    jitter: $("jitterOut"),
    photoReal: $("photoRealOut"),
    tilt: $("tiltOut")
  };

  init();

  function init() {
    resizeCanvasForCss(sampleCanvas);
    resizeCanvasForCss(previewCanvas);
    bindEvents();
    renderStyleSelect();
    renderSample();
    renderBlocks();
    renderCandidates();
    renderLibrary();
    renderStats();
    updateOutputs();
    renderDocuments();
    renderPreview();
  }

  function bindEvents() {
    controls.sampleInput.addEventListener("change", handleSampleUpload);
    controls.ocrBtn.addEventListener("click", runCloudOcr);
    controls.buildCandidatesBtn.addEventListener("click", buildCandidatesFromOcr);
    controls.acceptCandidatesBtn.addEventListener("click", acceptCandidates);
    controls.clearCandidatesBtn.addEventListener("click", () => {
      state.candidates = [];
      renderCandidates();
      renderSample();
      setStatus(controls.recognitionStatus, "已清空候选。", "");
    });

    sampleCanvas.addEventListener("pointerdown", startSelection);
    sampleCanvas.addEventListener("pointermove", moveSelection);
    sampleCanvas.addEventListener("pointerup", endSelection);
    sampleCanvas.addEventListener("pointerleave", endSelection);
    controls.addGlyphBtn.addEventListener("click", addSelectedGlyph);
    controls.clearSelectionBtn.addEventListener("click", () => {
      state.selection = null;
      renderSample();
    });

    controls.styleSelect.addEventListener("change", () => {
      state.library.activeStyle = controls.styleSelect.value;
      saveLibrary();
      renderLibrary();
      renderStats();
      renderPreview();
    });
    controls.addStyleBtn.addEventListener("click", addStyle);
    controls.deleteStyleBtn.addEventListener("click", deleteActiveStyle);
    controls.clearLibraryBtn.addEventListener("click", clearActiveLibrary);
    controls.copyPracticeBtn.addEventListener("click", copyPracticeText);

    Object.keys(outputs).forEach((key) => {
      controls[key].addEventListener("input", () => {
        updateOutputs();
        renderPreview();
      });
    });
    controls.customPaperInput.addEventListener("change", handleCustomPaperUpload);
    ["paperType", "penType", "textInput"].forEach((key) => {
      controls[key].addEventListener("input", () => {
        renderStats();
        renderPreview();
      });
    });

    controls.renderBtn.addEventListener("click", renderPreview);
    controls.randomizeBtn.addEventListener("click", () => {
      state.seed = Math.floor(Math.random() * 1000000);
      renderPreview();
    });
    controls.regionModeBtn.addEventListener("click", toggleRegionMode);
    controls.resetRegionBtn.addEventListener("click", () => {
      state.regionSelection = null;
      setStatus(controls.regionStatus, "已重置为默认纸面书写区域。", "");
      renderPreview();
    });
    previewCanvas.addEventListener("pointerdown", startRegionSelection);
    previewCanvas.addEventListener("pointermove", moveRegionSelection);
    previewCanvas.addEventListener("pointerup", endRegionSelection);
    previewCanvas.addEventListener("pointerleave", endRegionSelection);
    controls.downloadPngBtn.addEventListener("click", () => downloadCurrent("image/png", "personal-handwriting.png"));
    controls.downloadJpgBtn.addEventListener("click", () => downloadCurrent("image/jpeg", "personal-handwriting.jpg"));

    controls.documentInput.addEventListener("change", () => {
      const count = controls.documentInput.files ? controls.documentInput.files.length : 0;
      setStatus(controls.documentStatus, count ? `已选择 ${count} 个文档。` : "未上传文档。", "");
    });
    controls.extractDocsBtn.addEventListener("click", extractDocuments);
    controls.downloadBatchBtn.addEventListener("click", downloadBatch);

    window.addEventListener("resize", debounce(() => {
      resizeCanvasForCss(sampleCanvas);
      resizeCanvasForCss(previewCanvas);
      renderSample();
      renderPreview();
    }, 150));
  }

  function handleSampleUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    state.sampleFile = file;
    state.blocks = [];
    state.candidates = [];
    state.selection = null;
    controls.ocrText.value = "";

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        state.sampleImage = image;
        controls.emptySample.style.display = "none";
        renderSample();
        renderBlocks();
        renderCandidates();
        setStatus(controls.recognitionStatus, "照片已加载。点击“自动识别整张照片”开始 OCR。", "ok");
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function handleCustomPaperUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        state.customPaperImage = image;
        state.customPaperName = file.name;
        controls.paperType.value = "custom";
        setStatus(controls.regionStatus, `已载入自定义纸张：${file.name}`, "ok");
        renderPreview();
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async function runCloudOcr() {
    if (!state.sampleFile) {
      setStatus(controls.recognitionStatus, "请先上传一张手写照片。", "warn");
      return;
    }

    const form = new FormData();
    form.append("image", state.sampleFile);
    setStatus(controls.recognitionStatus, "正在调用本地 OCR 后端...", "");

    try {
      const response = await fetch("/api/ocr/handwriting", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "OCR 请求失败");

      state.blocks = normalizeBlocks(data.blocks || []);
      controls.ocrText.value = data.text || state.blocks.map((block) => block.words).join("\n");
      setStatus(controls.recognitionStatus, `识别完成：${state.blocks.length} 个文字块。请校对文本后生成字库候选。`, "ok");
      renderBlocks();
      renderSample();
      renderStats();
    } catch (error) {
      setStatus(controls.recognitionStatus, `OCR 失败：${error.message}。可以展开手动修正区域继续框选入库。`, "warn");
    }
  }

  function buildCandidatesFromOcr() {
    if (!state.sampleImage) {
      setStatus(controls.recognitionStatus, "请先上传手写照片。", "warn");
      return;
    }
    if (!state.blocks.length) {
      setStatus(controls.recognitionStatus, "还没有 OCR 文字块。请先自动识别，或使用手动修正。", "warn");
      return;
    }

    const lines = controls.ocrText.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const nextCandidates = [];
    state.blocks.forEach((block, blockIndex) => {
      const text = lines[blockIndex] || block.words || "";
      const chars = [...text].filter((char) => !/\s/.test(char));
      if (!chars.length) return;
      chars.forEach((char, charIndex) => {
        const rect = splitBlockRect(block.location, chars.length, charIndex);
        const crop = cropImageRect(rect, 4);
        if (!crop) return;
        nextCandidates.push({
          id: makeId(),
          char,
          dataUrl: crop.dataUrl,
          width: crop.width,
          height: crop.height,
          rect
        });
      });
    });

    state.candidates = nextCandidates;
    renderCandidates();
    renderSample();
    setStatus(controls.recognitionStatus, `已生成 ${state.candidates.length} 个字库候选。请检查候选字，确认无误后入库到“${getActiveStyle().name}”。`, state.candidates.length ? "ok" : "warn");
  }

  function acceptCandidates() {
    const style = getActiveStyle();
    const accepted = state.candidates.filter((candidate) => candidate.char);
    if (!accepted.length) {
      setStatus(controls.recognitionStatus, "没有可入库的候选。", "warn");
      return;
    }

    accepted.forEach((candidate) => {
      style.glyphs.push({
        id: makeId(),
        char: candidate.char,
        dataUrl: candidate.dataUrl,
        width: candidate.width,
        height: candidate.height
      });
    });

    state.candidates = [];
    saveLibrary();
    renderCandidates();
    renderLibrary();
    renderStats();
    renderPreview();
    renderSample();
    setStatus(controls.recognitionStatus, `已入库 ${accepted.length} 个字样到“${style.name}”。`, "ok");
  }

  function renderBlocks() {
    controls.blockCount.textContent = `${state.blocks.length} 个`;
    controls.blockList.innerHTML = "";
    if (!state.blocks.length) {
      controls.blockList.innerHTML = '<div class="block-item">暂无识别文字块。</div>';
      return;
    }
    state.blocks.forEach((block, index) => {
      const item = document.createElement("div");
      item.className = "block-item";
      item.textContent = `${index + 1}. ${block.words} (${Math.round(block.location.left)}, ${Math.round(block.location.top)}, ${Math.round(block.location.width)}x${Math.round(block.location.height)})`;
      controls.blockList.appendChild(item);
    });
  }

  function renderCandidates() {
    controls.candidateGrid.innerHTML = "";
    if (!state.candidates.length) {
      controls.candidateGrid.innerHTML = '<div class="missing-chars">还没有候选。OCR 后校对文本，再点击“生成字库候选”。</div>';
      return;
    }
    state.candidates.forEach((candidate) => {
      controls.candidateGrid.appendChild(createGlyphCard(candidate, {
        editable: true,
        removeTitle: "删除候选",
        onChange: (char) => { candidate.char = char; },
        onRemove: () => {
          state.candidates = state.candidates.filter((item) => item.id !== candidate.id);
          renderCandidates();
          renderSample();
        }
      }));
    });
  }

  function renderStyleSelect() {
    controls.styleSelect.innerHTML = "";
    state.library.styles.forEach((style) => {
      const option = document.createElement("option");
      option.value = style.id;
      option.textContent = style.name;
      controls.styleSelect.appendChild(option);
    });
    controls.styleSelect.value = state.library.activeStyle;
  }

  function addStyle() {
    const name = controls.styleName.value.trim();
    if (!name) {
      alert("请先输入新风格名称。");
      return;
    }
    const style = { id: makeId(), name, glyphs: [] };
    state.library.styles.push(style);
    state.library.activeStyle = style.id;
    controls.styleName.value = "";
    saveLibrary();
    renderStyleSelect();
    renderLibrary();
    renderStats();
    renderPreview();
  }

  function deleteActiveStyle() {
    if (state.library.styles.length <= 1) {
      alert("至少需要保留一个字库风格。");
      return;
    }
    const style = getActiveStyle();
    if (!confirm(`确定删除“${style.name}”吗？`)) return;
    state.library.styles = state.library.styles.filter((item) => item.id !== style.id);
    state.library.activeStyle = state.library.styles[0].id;
    saveLibrary();
    renderStyleSelect();
    renderLibrary();
    renderStats();
    renderPreview();
  }

  function clearActiveLibrary() {
    const style = getActiveStyle();
    if (!style.glyphs.length) return;
    if (!confirm(`确定清空“${style.name}”字库吗？这个操作无法撤销。`)) return;
    style.glyphs = [];
    saveLibrary();
    renderLibrary();
    renderStats();
    renderPreview();
  }

  function addSelectedGlyph() {
    const char = [...controls.glyphChar.value.trim()][0];
    if (!state.sampleImage || !state.selection || !char) {
      alert("请先上传照片、框选一个字，并填写绑定字符。");
      return;
    }
    const crop = cropImageRect(canvasSelectionToImageRect(state.selection), 3);
    if (!crop) {
      alert("框选区域需要落在样本图片内。");
      return;
    }
    getActiveStyle().glyphs.push({
      id: makeId(),
      char,
      dataUrl: crop.dataUrl,
      width: crop.width,
      height: crop.height
    });
    controls.glyphChar.value = "";
    state.selection = null;
    saveLibrary();
    renderLibrary();
    renderStats();
    renderPreview();
    renderSample();
  }

  function renderLibrary() {
    const style = getActiveStyle();
    controls.libraryGrid.innerHTML = "";
    if (!style.glyphs.length) {
      controls.libraryGrid.innerHTML = '<div class="missing-chars">当前风格字库为空。OCR 建候选后入库，或展开手动修正框选单字。</div>';
      return;
    }
    style.glyphs.forEach((glyph) => {
      controls.libraryGrid.appendChild(createGlyphCard(glyph, {
        editable: false,
        removeTitle: "删除字样",
        onRemove: () => {
          style.glyphs = style.glyphs.filter((item) => item.id !== glyph.id);
          saveLibrary();
          renderLibrary();
          renderStats();
          renderPreview();
        }
      }));
    });
  }

  function createGlyphCard(glyph, options) {
    const card = document.createElement("div");
    card.className = "glyph-card";
    const img = document.createElement("img");
    img.alt = glyph.char;
    img.src = glyph.dataUrl;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.title = options.removeTitle;
    remove.textContent = "×";
    remove.addEventListener("click", options.onRemove);
    card.appendChild(img);
    if (options.editable) {
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 2;
      input.value = glyph.char;
      input.addEventListener("input", () => options.onChange([...input.value.trim()][0] || ""));
      card.appendChild(input);
    } else {
      const label = document.createElement("strong");
      label.textContent = glyph.char;
      card.appendChild(label);
    }
    card.appendChild(remove);
    return card;
  }

  function renderStats() {
    const style = getActiveStyle();
    const glyphMap = groupGlyphs(style.glyphs);
    const collectedChars = new Set(style.glyphs.map((glyph) => glyph.char));
    const commonSet = new Set([...COMMON_CHARS]);
    const commonCovered = [...commonSet].filter((char) => collectedChars.has(char)).length;
    const targetText = controls.textInput.value + "\n" + controls.ocrText.value;
    const missing = uniqueChars(targetText).filter((char) => !glyphMap.has(char));
    const commonMissing = [...commonSet].filter((char) => !glyphMap.has(char)).slice(0, 80);
    const practice = [...new Set([...missing, ...commonMissing])].slice(0, 120).join("");

    controls.glyphCount.textContent = String(collectedChars.size);
    controls.sampleCount.textContent = String(style.glyphs.length);
    controls.coverageRate.textContent = `${Math.round((commonCovered / commonSet.size) * 100)}%`;
    controls.practiceText.value = practice;

    if (missing.length) {
      controls.missingChars.classList.add("warn");
      controls.missingChars.textContent = `当前文本缺字：${missing.join(" ")}。已生成补录任务，可复制后手写拍照入库。`;
    } else if (style.glyphs.length) {
      controls.missingChars.classList.remove("warn");
      controls.missingChars.textContent = "当前输入文本在该风格字库中已覆盖。";
    } else {
      controls.missingChars.classList.add("warn");
      controls.missingChars.textContent = "当前风格字库为空。先上传照片 OCR，或使用手动修正补录。";
    }
  }

  async function copyPracticeText() {
    const text = controls.practiceText.value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      controls.copyPracticeBtn.textContent = "已复制";
      setTimeout(() => { controls.copyPracticeBtn.textContent = "复制补写内容"; }, 1200);
    } catch (error) {
      controls.practiceText.select();
      document.execCommand("copy");
    }
  }

  async function extractDocuments() {
    const files = [...(controls.documentInput.files || [])];
    if (!files.length) {
      setStatus(controls.documentStatus, "请先选择 Word 或 PDF 文件。", "warn");
      return;
    }
    const form = new FormData();
    files.forEach((file) => form.append("documents", file));
    setStatus(controls.documentStatus, `正在提取 ${files.length} 个文档...`, "");
    try {
      const response = await fetch("/api/batch/extract", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "文档提取失败");
      state.documents = data.documents || [];
      renderDocuments();
      setStatus(controls.documentStatus, `已提取 ${state.documents.length} 个文档。`, "ok");
    } catch (error) {
      setStatus(controls.documentStatus, `文档提取失败：${error.message}`, "warn");
    }
  }

  function renderDocuments() {
    controls.documentTasks.innerHTML = "";
    if (!state.documents.length) {
      controls.documentTasks.innerHTML = '<div class="doc-item">暂无文档任务。</div>';
      return;
    }
    state.documents.forEach((doc, index) => {
      const item = document.createElement("div");
      item.className = "doc-item";
      const pageCount = doc.pages ? doc.pages.length : 0;
      item.innerHTML = `<strong>${doc.filename}</strong><br>${pageCount} 页 / ${doc.text.length} 字`;
      const row = document.createElement("div");
      row.className = "toolbar";
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "ghost small";
      useBtn.textContent = "放入生成区";
      useBtn.addEventListener("click", () => {
        controls.textInput.value = doc.text;
        renderStats();
        renderPreview();
      });
      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "ghost small";
      downloadBtn.textContent = "下载本文档";
      downloadBtn.addEventListener("click", () => downloadDocument(doc));
      row.append(useBtn, downloadBtn);
      item.appendChild(row);
      controls.documentTasks.appendChild(item);
    });
  }

  async function downloadBatch() {
    if (!state.documents.length) {
      setStatus(controls.documentStatus, "没有可下载的文档任务。", "warn");
      return;
    }
    for (const doc of state.documents) {
      await downloadDocument(doc);
    }
  }

  async function downloadDocument(doc) {
    const pages = doc.pages && doc.pages.length ? doc.pages : splitTextPages(doc.text);
    for (let index = 0; index < pages.length; index += 1) {
      const canvas = renderTextToCanvas(pages[index], state.seed + index + 1);
      downloadCanvas(canvas, "image/png", `${safeName(doc.filename)}-第${index + 1}页.png`);
      await sleep(160);
    }
  }

  function renderPreview() {
    resizeCanvasForCss(previewCanvas);
    renderTextOnCanvas(previewCanvas, controls.textInput.value || "", state.seed);
    renderStats();
  }

  function renderTextToCanvas(text, seed) {
    const canvas = document.createElement("canvas");
    canvas.width = 1120;
    canvas.height = 820;
    renderTextOnCanvas(canvas, text, seed);
    return canvas;
  }

  function renderTextOnCanvas(canvas, text, seed) {
    const ctx = canvas.getContext("2d");
    const settings = getSettings();
    const rng = seededRandom(seed);
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    drawDesk(ctx, w, h);

    const paper = { w: Math.round(w * 0.88), h: Math.round(h * 0.86), x: Math.round(w * 0.06), y: Math.round(h * 0.05) };
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((settings.tilt * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
    drawPaper(ctx, paper, settings, rng);
    drawText(ctx, paper, settings, rng, text);
    drawRegionOverlay(ctx, paper);
    ctx.restore();
    drawPhotoLayer(ctx, w, h, settings, rng);
  }

  function drawDesk(ctx, w, h) {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#d5dbe4");
    gradient.addColorStop(1, "#b9c2cf");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function drawPaper(ctx, paper, settings, rng) {
    ctx.save();
    ctx.shadowColor = "rgba(18, 25, 38, 0.28)";
    ctx.shadowBlur = 22 + settings.photoReal * 2;
    ctx.shadowOffsetX = 8 + settings.photoReal;
    ctx.shadowOffsetY = 14 + settings.photoReal * 1.4;
    if (settings.paperType === "custom" && state.customPaperImage) {
      drawCoverImage(ctx, state.customPaperImage, paper.x, paper.y, paper.w, paper.h);
    } else {
      ctx.fillStyle = "#fbfaf5";
      ctx.fillRect(paper.x, paper.y, paper.w, paper.h);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 700 + settings.photoReal * 80; i += 1) {
      const v = Math.floor(180 + rng() * 45);
      ctx.fillStyle = `rgb(${v},${v},${v - 8})`;
      ctx.fillRect(paper.x + rng() * paper.w, paper.y + rng() * paper.h, 1.5, 1.5);
    }
    ctx.restore();

    if (settings.paperType === "custom" && state.customPaperImage) {
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.strokeRect(paper.x, paper.y, paper.w, paper.h);
      return;
    }
    if (settings.paperType === "a4") {
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.strokeRect(paper.x + 42, paper.y + 42, paper.w - 84, paper.h - 84);
      return;
    }
    if (settings.paperType === "lined") drawLinedPaper(ctx, paper, settings.lineHeight);
    if (settings.paperType === "grid") drawGridPaper(ctx, paper, Math.max(34, settings.lineHeight - 8), false);
    if (settings.paperType === "essay") drawGridPaper(ctx, paper, Math.max(38, settings.lineHeight - 4), true);
  }

  function drawCoverImage(ctx, image, x, y, w, h) {
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (image.naturalWidth - sw) / 2;
    const sy = (image.naturalHeight - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  }

  function drawLinedPaper(ctx, paper, gap) {
    ctx.strokeStyle = "rgba(80, 116, 170, 0.28)";
    ctx.lineWidth = 1;
    for (let y = paper.y + 78; y < paper.y + paper.h - 34; y += gap) {
      ctx.beginPath();
      ctx.moveTo(paper.x + 44, y);
      ctx.lineTo(paper.x + paper.w - 44, y);
      ctx.stroke();
    }
  }

  function drawGridPaper(ctx, paper, size, essay) {
    ctx.strokeStyle = essay ? "rgba(202, 94, 94, 0.24)" : "rgba(80, 116, 170, 0.18)";
    ctx.lineWidth = 1;
    for (let x = paper.x + 42; x < paper.x + paper.w - 40; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, paper.y + 38);
      ctx.lineTo(x, paper.y + paper.h - 38);
      ctx.stroke();
    }
    for (let y = paper.y + 42; y < paper.y + paper.h - 38; y += size) {
      ctx.beginPath();
      ctx.moveTo(paper.x + 38, y);
      ctx.lineTo(paper.x + paper.w - 38, y);
      ctx.stroke();
    }
  }

  function drawText(ctx, paper, settings, rng, text) {
    const glyphMap = groupGlyphs(getActiveStyle().glyphs);
    const box = getWritingBox(paper);
    const maxX = box.x + box.w;
    let x = box.x;
    let y = box.y + settings.fontSize;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = settings.inkColor;

    for (const char of text) {
      if (char === "\n") {
        x = box.x + randRange(rng, -settings.jitter, settings.jitter);
        y += settings.lineHeight + randRange(rng, -4, 7);
        continue;
      }
      if (char === " ") {
        x += settings.fontSize * 0.65;
        continue;
      }
      const naturalWidth = estimateCharWidth(char, settings);
      if (x + naturalWidth > maxX) {
        x = box.x + randRange(rng, -settings.jitter, settings.jitter);
        y += settings.lineHeight + randRange(rng, -4, 7);
      }
      if (y > box.y + box.h) break;

      const glyphs = glyphMap.get(char);
      const dx = randRange(rng, -settings.jitter, settings.jitter);
      const dy = randRange(rng, -settings.jitter * 0.7, settings.jitter * 0.7);
      const angle = randRange(rng, -0.045, 0.045) * (1 + settings.jitter / 8);
      const scale = randRange(rng, 0.92, 1.08);
      ctx.save();
      ctx.globalAlpha = settings.pen.alpha * randRange(rng, 0.9, 1);
      ctx.translate(x + dx, y + dy);
      ctx.rotate(angle);
      if (glyphs && glyphs.length) {
        const glyph = glyphs[Math.floor(rng() * glyphs.length)];
        drawGlyphImage(ctx, glyph, settings.fontSize, scale, settings);
        x += Math.max(16, settings.fontSize * (glyph.width / Math.max(glyph.height, 1)) * 0.88 * scale) + settings.letterGap + randRange(rng, -2, 4);
      } else {
        drawFallbackChar(ctx, char, settings, scale);
        x += naturalWidth + settings.letterGap + randRange(rng, -2, 4);
      }
      ctx.restore();
    }
  }

  function getWritingBox(paper) {
    if (state.regionSelection) {
      return {
        x: paper.x + paper.w * state.regionSelection.x,
        y: paper.y + paper.h * state.regionSelection.y,
        w: paper.w * state.regionSelection.w,
        h: paper.h * state.regionSelection.h
      };
    }
    return {
      x: paper.x + paper.w * 0.095,
      y: paper.y + paper.h * 0.105,
      w: paper.w * 0.81,
      h: paper.h * 0.78
    };
  }

  function drawRegionOverlay(ctx, paper) {
    if (!state.regionMode && !state.regionSelection) return;
    const box = getWritingBox(paper);
    ctx.save();
    ctx.setLineDash([10, 7]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = state.regionMode ? "rgba(50, 97, 90, 0.95)" : "rgba(50, 97, 90, 0.42)";
    ctx.fillStyle = state.regionMode ? "rgba(50, 97, 90, 0.08)" : "rgba(50, 97, 90, 0.035)";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();
  }

  function toggleRegionMode() {
    state.regionMode = !state.regionMode;
    controls.regionModeBtn.textContent = state.regionMode ? "完成框选" : "框选书写区域";
    setStatus(controls.regionStatus, state.regionMode ? "在预览纸张上拖拽，设置文字写入的区域。" : "已退出框选模式。", state.regionMode ? "ok" : "");
    renderPreview();
  }

  function startRegionSelection(event) {
    if (!state.regionMode) return;
    const point = canvasPoint(previewCanvas, event);
    const paper = getCurrentPreviewPaper();
    state.isRegionDragging = true;
    state.regionDragStart = clampPointToPaper(point, paper);
    previewCanvas.setPointerCapture(event.pointerId);
  }

  function moveRegionSelection(event) {
    if (!state.regionMode || !state.isRegionDragging || !state.regionDragStart) return;
    const paper = getCurrentPreviewPaper();
    const point = clampPointToPaper(canvasPoint(previewCanvas, event), paper);
    state.regionSelection = normalizeRegionFromPoints(state.regionDragStart, point, paper);
    renderPreview();
  }

  function endRegionSelection(event) {
    if (!state.isRegionDragging) return;
    state.isRegionDragging = false;
    if (event.pointerId !== undefined && previewCanvas.hasPointerCapture(event.pointerId)) {
      previewCanvas.releasePointerCapture(event.pointerId);
    }
    if (state.regionSelection && state.regionSelection.w > 0.03 && state.regionSelection.h > 0.03) {
      setStatus(controls.regionStatus, "书写区域已更新。生成文字会限制在框选范围内。", "ok");
    } else {
      state.regionSelection = null;
      setStatus(controls.regionStatus, "框选区域太小，已恢复默认书写区域。", "warn");
    }
    renderPreview();
  }

  function getCurrentPreviewPaper() {
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    return { w: Math.round(w * 0.88), h: Math.round(h * 0.86), x: Math.round(w * 0.06), y: Math.round(h * 0.05) };
  }

  function clampPointToPaper(point, paper) {
    return {
      x: clamp(point.x, paper.x, paper.x + paper.w),
      y: clamp(point.y, paper.y, paper.y + paper.h)
    };
  }

  function normalizeRegionFromPoints(a, b, paper) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    return {
      x: (x - paper.x) / paper.w,
      y: (y - paper.y) / paper.h,
      w: w / paper.w,
      h: h / paper.h
    };
  }

  function drawGlyphImage(ctx, glyph, fontSize, scale, settings) {
    const img = new Image();
    img.src = glyph.dataUrl;
    const ratio = glyph.width / Math.max(glyph.height, 1);
    const drawH = fontSize * 1.35 * scale;
    const drawW = drawH * ratio;
    if (img.complete) {
      ctx.drawImage(img, 0, -drawH + fontSize * 0.18, drawW, drawH);
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = settings.inkColor;
      ctx.globalAlpha = settings.pen.stroke === 1.25 ? 0.26 : 0.18;
      ctx.fillRect(0, -drawH + fontSize * 0.18, drawW, drawH);
      ctx.restore();
    } else {
      img.onload = renderPreview;
      drawFallbackChar(ctx, glyph.char, settings, scale);
    }
  }

  function drawFallbackChar(ctx, char, settings, scale) {
    ctx.font = `${settings.fontSize * scale}px "KaiTi", "STKaiti", "Microsoft YaHei", cursive`;
    ctx.lineWidth = Math.max(1, (settings.fontSize / 22) * settings.pen.stroke);
    ctx.strokeStyle = transparentize(settings.inkColor, 0.18);
    ctx.fillStyle = settings.inkColor;
    ctx.strokeText(char, 0, 0);
    ctx.fillText(char, 0, 0);
  }

  function drawPhotoLayer(ctx, w, h, settings, rng) {
    const vignette = ctx.createRadialGradient(w * 0.48, h * 0.48, w * 0.18, w * 0.48, h * 0.48, w * 0.74);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, `rgba(24,32,45,${0.07 + settings.photoReal * 0.01})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.035 + settings.photoReal * 0.006;
    for (let i = 0; i < 1600; i += 1) {
      const shade = Math.floor(rng() * 255);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(rng() * w, rng() * h, 1, 1);
    }
    ctx.restore();
  }

  function renderSample() {
    sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    sampleCtx.fillStyle = "#f4f6f9";
    sampleCtx.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    if (!state.sampleImage) {
      controls.emptySample.style.display = "grid";
      return;
    }
    controls.emptySample.style.display = "none";
    const image = state.sampleImage;
    const scale = Math.min(sampleCanvas.width / image.naturalWidth, sampleCanvas.height / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const offsetX = (sampleCanvas.width - drawW) / 2;
    const offsetY = (sampleCanvas.height - drawH) / 2;
    state.imageScale = scale;
    state.imageOffsetX = offsetX;
    state.imageOffsetY = offsetY;
    sampleCtx.drawImage(image, offsetX, offsetY, drawW, drawH);
    drawBlocksOverlay();
    drawCandidatesOverlay();
    drawSelectionOverlay();
  }

  function drawBlocksOverlay() {
    sampleCtx.save();
    sampleCtx.strokeStyle = "rgba(36, 87, 214, 0.9)";
    sampleCtx.fillStyle = "rgba(36, 87, 214, 0.08)";
    sampleCtx.lineWidth = 2;
    state.blocks.forEach((block) => {
      const rect = imageRectToCanvas(block.location);
      sampleCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
      sampleCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    });
    sampleCtx.restore();
  }

  function drawCandidatesOverlay() {
    sampleCtx.save();
    sampleCtx.strokeStyle = "rgba(23, 101, 53, 0.95)";
    sampleCtx.lineWidth = 1.5;
    state.candidates.forEach((candidate) => {
      const rect = imageRectToCanvas(candidate.rect);
      sampleCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    });
    sampleCtx.restore();
  }

  function drawSelectionOverlay() {
    if (!state.selection) return;
    const rect = normalizeRect(state.selection);
    sampleCtx.save();
    sampleCtx.strokeStyle = "#b42318";
    sampleCtx.lineWidth = 3;
    sampleCtx.setLineDash([9, 6]);
    sampleCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    sampleCtx.fillStyle = "rgba(180, 35, 24, 0.12)";
    sampleCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    sampleCtx.restore();
  }

  function startSelection(event) {
    if (!state.sampleImage) return;
    const point = canvasPoint(sampleCanvas, event);
    state.isDragging = true;
    state.dragStart = point;
    state.selection = { x: point.x, y: point.y, w: 0, h: 0 };
    sampleCanvas.setPointerCapture(event.pointerId);
    renderSample();
  }

  function moveSelection(event) {
    if (!state.isDragging || !state.dragStart) return;
    const point = canvasPoint(sampleCanvas, event);
    state.selection = { x: state.dragStart.x, y: state.dragStart.y, w: point.x - state.dragStart.x, h: point.y - state.dragStart.y };
    renderSample();
  }

  function endSelection(event) {
    if (!state.isDragging) return;
    state.isDragging = false;
    if (event.pointerId !== undefined && sampleCanvas.hasPointerCapture(event.pointerId)) {
      sampleCanvas.releasePointerCapture(event.pointerId);
    }
    const rect = normalizeRect(state.selection);
    state.selection = rect && rect.w >= 12 && rect.h >= 12 ? rect : null;
    renderSample();
  }

  function getSettings() {
    const pen = PEN_PRESETS[controls.penType.value] || PEN_PRESETS.blackGel;
    return {
      paperType: controls.paperType.value,
      pen,
      inkColor: pen.color,
      fontSize: Number(controls.fontSize.value),
      lineHeight: Number(controls.lineHeight.value),
      letterGap: Number(controls.letterGap.value),
      jitter: Number(controls.jitter.value),
      photoReal: Number(controls.photoReal.value),
      tilt: Number(controls.tilt.value)
    };
  }

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      if (raw) return normalizeLibrary(JSON.parse(raw));
      const legacy = localStorage.getItem(LEGACY_KEY);
      const legacyGlyphs = legacy ? JSON.parse(legacy) : [];
      const library = normalizeLibrary({ activeStyle: "daily", styles: DEFAULT_STYLES });
      if (Array.isArray(legacyGlyphs) && legacyGlyphs.length) {
        library.styles.find((style) => style.id === "daily").glyphs = legacyGlyphs;
      }
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
      return library;
    } catch (error) {
      console.warn("字库读取失败", error);
      return normalizeLibrary({ activeStyle: "daily", styles: DEFAULT_STYLES });
    }
  }

  function normalizeLibrary(value) {
    const styles = Array.isArray(value.styles) && value.styles.length ? value.styles : DEFAULT_STYLES;
    const cloned = styles.map((style) => ({
      id: style.id || makeId(),
      name: style.name || "未命名风格",
      glyphs: Array.isArray(style.glyphs) ? style.glyphs : []
    }));
    const activeStyle = cloned.some((style) => style.id === value.activeStyle) ? value.activeStyle : cloned[0].id;
    return { activeStyle, styles: cloned };
  }

  function saveLibrary() {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(state.library));
  }

  function getActiveStyle() {
    return state.library.styles.find((style) => style.id === state.library.activeStyle) || state.library.styles[0];
  }

  function groupGlyphs(glyphs) {
    const map = new Map();
    glyphs.forEach((glyph) => {
      if (!map.has(glyph.char)) map.set(glyph.char, []);
      map.get(glyph.char).push(glyph);
    });
    return map;
  }

  function normalizeBlocks(blocks) {
    return blocks
      .map((block) => {
        const loc = block.location || {};
        return {
          words: block.words || "",
          location: {
            left: Number(loc.left || loc.x || 0),
            top: Number(loc.top || loc.y || 0),
            width: Number(loc.width || 0),
            height: Number(loc.height || 0)
          }
        };
      })
      .filter((block) => block.words && block.location.width > 0 && block.location.height > 0)
      .sort((a, b) => a.location.top - b.location.top || a.location.left - b.location.left);
  }

  function splitBlockRect(location, total, index) {
    return {
      left: location.left + (location.width * index) / total,
      top: location.top,
      width: location.width / total,
      height: location.height
    };
  }

  function cropImageRect(rect, padding) {
    if (!state.sampleImage) return null;
    const image = state.sampleImage;
    const left = clamp(rect.left - padding, 0, image.naturalWidth);
    const top = clamp(rect.top - padding, 0, image.naturalHeight);
    const right = clamp(rect.left + rect.width + padding, 0, image.naturalWidth);
    const bottom = clamp(rect.top + rect.height + padding, 0, image.naturalHeight);
    const width = Math.max(8, Math.round(right - left));
    const height = Math.max(8, Math.round(bottom - top));
    if (width < 8 || height < 8) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, left, top, width, height, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  }

  function imageRectToCanvas(rect) {
    return {
      x: state.imageOffsetX + rect.left * state.imageScale,
      y: state.imageOffsetY + rect.top * state.imageScale,
      w: rect.width * state.imageScale,
      h: rect.height * state.imageScale
    };
  }

  function canvasSelectionToImageRect(selection) {
    const rect = normalizeRect(selection);
    return {
      left: (rect.x - state.imageOffsetX) / state.imageScale,
      top: (rect.y - state.imageOffsetY) / state.imageScale,
      width: rect.w / state.imageScale,
      height: rect.h / state.imageScale
    };
  }

  function splitTextPages(text) {
    const normalized = (text || "").replace(/\r\n/g, "\n").trim();
    if (!normalized) return [];
    const pages = [];
    let buffer = "";
    normalized.split(/\n+/).forEach((paragraph) => {
      if ((buffer + "\n" + paragraph).length > 620 && buffer) {
        pages.push(buffer.trim());
        buffer = paragraph;
      } else {
        buffer += (buffer ? "\n" : "") + paragraph;
      }
    });
    if (buffer.trim()) pages.push(buffer.trim());
    return pages;
  }

  function uniqueChars(text) {
    return [...new Set([...(text || "")].filter((char) => /[\u4e00-\u9fa5A-Za-z0-9]/.test(char)))];
  }

  function updateOutputs() {
    Object.keys(outputs).forEach((key) => {
      outputs[key].textContent = controls[key].value;
    });
  }

  function downloadCurrent(type, filename) {
    renderPreview();
    downloadCanvas(previewCanvas, type, filename);
  }

  function downloadCanvas(canvas, type, filename) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL(type, type === "image/jpeg" ? 0.92 : undefined);
    link.click();
  }

  function setStatus(element, message, mode) {
    element.textContent = message;
    element.classList.remove("warn", "ok");
    if (mode) element.classList.add(mode);
  }

  function resizeCanvasForCss(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(320, Math.round(rect.width * ratio));
    const height = Math.max(240, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function estimateCharWidth(char, settings) {
    if (/[\u4e00-\u9fa5]/.test(char)) return settings.fontSize * 1.02;
    if (/[，。！？；：“”‘’、]/.test(char)) return settings.fontSize * 0.68;
    return settings.fontSize * 0.72;
  }

  function canvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  }

  function normalizeRect(rect) {
    if (!rect) return null;
    const x = Math.min(rect.x, rect.x + rect.w);
    const y = Math.min(rect.y, rect.y + rect.h);
    return { x, y, w: Math.abs(rect.w), h: Math.abs(rect.h) };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function randRange(rng, min, max) {
    return min + (max - min) * rng();
  }

  function seededRandom(seed) {
    let value = seed || 1;
    return function next() {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function transparentize(hex, alpha) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function safeName(name) {
    return (name || "document").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }
})();

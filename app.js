/* 订醒 SubWake — local subscription ledger */
(function () {
  "use strict";

  const STORAGE_KEY = "subwake:v1";
  const USD_TO_CNY = 7.2;
  const WEEK_FACTOR = 4.345;

  const CYCLE_LABEL = {
    weekly: "每周",
    monthly: "每月",
    quarterly: "每季",
    yearly: "每年",
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  /** Local calendar date YYYY-MM-DD (Asia/Shanghai friendly via local clock) */
  function todayStr() {
    const d = new Date();
    return toDateStr(d);
  }

  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function daysUntil(dateStr) {
    const target = parseDate(dateStr);
    if (!target) return null;
    const now = parseDate(todayStr());
    const ms = target.getTime() - now.getTime();
    return Math.round(ms / 86400000);
  }

  function uid() {
    return "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function monthlyCNY(sub) {
    let monthly = Number(sub.amount) || 0;
    switch (sub.cycle) {
      case "weekly":
        monthly *= WEEK_FACTOR;
        break;
      case "monthly":
        break;
      case "quarterly":
        monthly /= 3;
        break;
      case "yearly":
        monthly /= 12;
        break;
    }
    if (sub.currency === "USD") monthly *= USD_TO_CNY;
    return monthly;
  }

  function formatMoney(amount, currency) {
    const n = Number(amount) || 0;
    const fixed = n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
    if (currency === "USD") return "$" + fixed;
    return "¥" + fixed;
  }

  function formatCNY(n) {
    const v = Math.round(n * 100) / 100;
    const fixed = v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
    return "¥" + fixed;
  }

  function addDaysStr(baseStr, days) {
    const d = parseDate(baseStr) || new Date();
    d.setDate(d.getDate() + days);
    return toDateStr(d);
  }

  function seedDemo() {
    const t = todayStr();
    return [
      {
        id: uid(),
        name: "ChatGPT Plus",
        amount: 20,
        currency: "USD",
        cycle: "monthly",
        nextRenew: addDaysStr(t, 5),
        category: "AI工具",
        trialEnd: "",
        cancelUrl: "https://chatgpt.com/",
        note: "示例 · 海外订阅",
        status: "active",
        demo: true,
      },
      {
        id: uid(),
        name: "Netflix",
        amount: 68,
        currency: "CNY",
        cycle: "monthly",
        nextRenew: addDaysStr(t, 2),
        category: "流媒体",
        trialEnd: "",
        cancelUrl: "",
        note: "示例 · 标准档",
        status: "active",
        demo: true,
      },
      {
        id: uid(),
        name: "iCloud+",
        amount: 21,
        currency: "CNY",
        cycle: "monthly",
        nextRenew: addDaysStr(t, 18),
        category: "云服务",
        trialEnd: "",
        cancelUrl: "",
        note: "示例 · 200GB",
        status: "active",
        demo: true,
      },
      {
        id: uid(),
        name: "Notion AI",
        amount: 10,
        currency: "USD",
        cycle: "monthly",
        nextRenew: addDaysStr(t, 12),
        category: "效率",
        trialEnd: addDaysStr(t, 4),
        cancelUrl: "https://www.notion.so/",
        note: "示例 · 试用将转正",
        status: "active",
        demo: true,
      },
      {
        id: uid(),
        name: "Keep 会员",
        amount: 198,
        currency: "CNY",
        cycle: "yearly",
        nextRenew: addDaysStr(t, 40),
        category: "健身",
        trialEnd: "",
        cancelUrl: "",
        note: "示例 · 年付",
        status: "active",
        demo: true,
      },
    ];
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const items = seedDemo();
        const state = { items, seeded: true };
        saveState(state);
        return state;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) {
        const items = seedDemo();
        const state = { items, seeded: true };
        saveState(state);
        return state;
      }
      return parsed;
    } catch {
      const items = seedDemo();
      return { items, seeded: true };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = loadState();
  let simSelected = new Set();
  let editingId = null;

  /* ---------- Render ---------- */

  function render() {
    renderDash();
    renderDemoBanner();
    renderList();
    renderSim();
  }

  function activeItems() {
    return state.items.filter((s) => s.status === "active");
  }

  function renderDash() {
    const active = activeItems();
    const monthly = active.reduce((sum, s) => sum + monthlyCNY(s), 0);
    const yearly = monthly * 12;

    $("#statMonthly").textContent = formatCNY(monthly);
    $("#statYearly").textContent = "年化约 " + formatCNY(yearly);

    const soon = active.filter((s) => {
      const d = daysUntil(s.nextRenew);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    $("#statSoon").textContent = String(soon);

    const trial = active.filter((s) => {
      if (!s.trialEnd) return false;
      const d = daysUntil(s.trialEnd);
      return d !== null && d >= 0 && d <= 14;
    }).length;
    $("#statTrial").textContent = String(trial);
  }

  function renderDemoBanner() {
    const hasDemo = state.items.some((s) => s.demo);
    const banner = $("#demoBanner");
    if (hasDemo) banner.removeAttribute("hidden");
    else banner.setAttribute("hidden", "");
  }

  function getFiltered() {
    const cat = $("#filterCat").value;
    const status = $("#filterStatus").value;
    const sort = $("#sortBy").value;

    let list = state.items.slice();
    if (cat !== "all") list = list.filter((s) => s.category === cat);
    if (status !== "all") list = list.filter((s) => s.status === status);

    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh");
      if (sort === "amount") return monthlyCNY(b) - monthlyCNY(a);
      // next renew
      const da = daysUntil(a.nextRenew);
      const db = daysUntil(b.nextRenew);
      const na = da === null ? 9999 : da;
      const nb = db === null ? 9999 : db;
      return na - nb;
    });
    return list;
  }

  function urgencyClass(days) {
    if (days === null) return "";
    if (days < 0) return "";
    if (days <= 3) return "urgent";
    if (days <= 7) return "warn";
    return "";
  }

  function renderList() {
    const list = getFiltered();
    const ul = $("#subList");
    const empty = $("#emptyState");
    $("#listCount").textContent = list.length + " 项";

    if (list.length === 0) {
      ul.innerHTML = "";
      empty.removeAttribute("hidden");
      return;
    }
    empty.setAttribute("hidden", "");

    ul.innerHTML = list
      .map((sub, i) => {
        const days = daysUntil(sub.nextRenew);
        const urg = urgencyClass(days);
        const trialDays = sub.trialEnd ? daysUntil(sub.trialEnd) : null;
        const cardClass = [
          "sub-card",
          urg === "urgent" ? "is-urgent" : "",
          urg === "warn" ? "is-warn" : "",
          sub.status === "cancelled" ? "is-cancelled" : "",
        ]
          .filter(Boolean)
          .join(" ");

        let daysHtml = "";
        if (days !== null) {
          if (days < 0) daysHtml = `<span class="days-pill">已过期 ${-days} 天</span>`;
          else if (days === 0)
            daysHtml = `<span class="days-pill ${urg}">今天扣款</span>`;
          else
            daysHtml = `<span class="days-pill ${urg}">还有 ${days} 天</span>`;
        }

        let badges = `<span class="badge badge-cat">${escapeHtml(sub.category)}</span>`;
        if (sub.demo) badges += `<span class="badge badge-demo">示例</span>`;
        if (sub.status === "cancelled")
          badges += `<span class="badge badge-status">已取消</span>`;
        if (urg === "urgent")
          badges += `<span class="badge badge-urgent">紧急</span>`;
        else if (urg === "warn")
          badges += `<span class="badge badge-warn">即将扣款</span>`;
        if (trialDays !== null && trialDays >= 0 && trialDays <= 14)
          badges += `<span class="badge badge-trial">试用 ${trialDays === 0 ? "今日到期" : trialDays + " 天后到期"}</span>`;

        const checked = simSelected.has(sub.id) ? "checked" : "";
        const checkDisabled = sub.status !== "active" ? "disabled" : "";

        const cancelLink = sub.cancelUrl
          ? `<a class="link-cancel" href="${escapeAttr(sub.cancelUrl)}" target="_blank" rel="noopener noreferrer">打开取消页</a>`
          : "";

        const note = sub.note
          ? `<p class="sub-note">${escapeHtml(sub.note)}</p>`
          : "";

        return `
          <li class="${cardClass}" style="animation-delay:${Math.min(i, 8) * 0.03}s" data-id="${escapeAttr(sub.id)}">
            <div class="sub-top">
              <input type="checkbox" class="sub-check" data-sim="${escapeAttr(sub.id)}" ${checked} ${checkDisabled} aria-label="模拟取消 ${escapeAttr(sub.name)}" />
              <div class="sub-main" data-edit="${escapeAttr(sub.id)}" role="button" tabindex="0" aria-label="编辑 ${escapeAttr(sub.name)}">
                <div class="sub-name-row">
                  <span class="sub-name">${escapeHtml(sub.name)}</span>
                  ${badges}
                </div>
                <div class="sub-meta">
                  <span>${daysHtml}</span>
                  <span>下次 <strong>${escapeHtml(sub.nextRenew || "—")}</strong></span>
                  <span>折算约 <strong>${formatCNY(monthlyCNY(sub))}</strong>/月</span>
                </div>
                ${note}
              </div>
              <div class="sub-amount">
                <span class="amt">${formatMoney(sub.amount, sub.currency)}</span>
                <span class="cycle">${CYCLE_LABEL[sub.cycle] || sub.cycle}</span>
              </div>
            </div>
            ${cancelLink ? `<div class="sub-actions">${cancelLink}</div>` : ""}
          </li>`;
      })
      .join("");
  }

  function renderSim() {
    let save = 0;
    simSelected.forEach((id) => {
      const sub = state.items.find((s) => s.id === id);
      if (sub && sub.status === "active") save += monthlyCNY(sub);
    });
    $("#simSave").textContent = "可省 " + formatCNY(save) + " / 月";
    $("#simSaveBig").textContent = formatCNY(save);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  /* ---------- Form ---------- */

  function openForm(sub) {
    editingId = sub ? sub.id : null;
    $("#formTitle").textContent = sub ? "编辑订阅" : "添加订阅";
    $("#fId").value = sub ? sub.id : "";
    $("#fName").value = sub ? sub.name : "";
    $("#fAmount").value = sub ? sub.amount : "";
    $("#fCurrency").value = sub ? sub.currency : "CNY";
    $("#fCycle").value = sub ? sub.cycle : "monthly";
    $("#fNext").value = sub ? sub.nextRenew : addDaysStr(todayStr(), 30);
    $("#fCategory").value = sub ? sub.category : "其他";
    $("#fTrial").value = sub && sub.trialEnd ? sub.trialEnd : "";
    $("#fStatus").value = sub ? sub.status : "active";
    $("#fCancelUrl").value = sub && sub.cancelUrl ? sub.cancelUrl : "";
    $("#fNote").value = sub && sub.note ? sub.note : "";

    const del = $("#btnDelete");
    if (sub) del.removeAttribute("hidden");
    else del.setAttribute("hidden", "");

    $("#formOverlay").removeAttribute("hidden");
    setTimeout(() => $("#fName").focus(), 50);
  }

  function closeForm() {
    $("#formOverlay").setAttribute("hidden", "");
    editingId = null;
  }

  function openBackup() {
    $("#backupOverlay").removeAttribute("hidden");
  }

  function closeBackup() {
    $("#backupOverlay").setAttribute("hidden", "");
  }

  /* ---------- Events ---------- */

  $("#btnAdd").addEventListener("click", () => openForm(null));
  $("#btnEmptyAdd").addEventListener("click", () => openForm(null));
  $("#btnCloseForm").addEventListener("click", closeForm);
  $("#btnCancelForm").addEventListener("click", closeForm);
  $("#btnBackup").addEventListener("click", openBackup);
  $("#btnCloseBackup").addEventListener("click", closeBackup);

  $("#formOverlay").addEventListener("click", (e) => {
    if (e.target === $("#formOverlay")) closeForm();
  });
  $("#backupOverlay").addEventListener("click", (e) => {
    if (e.target === $("#backupOverlay")) closeBackup();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#formOverlay").hidden) closeForm();
      else if (!$("#backupOverlay").hidden) closeBackup();
    }
  });

  $("#subForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#fName").value.trim();
    const amount = parseFloat($("#fAmount").value);
    const next = $("#fNext").value;
    if (!name || !(amount >= 0) || !next) {
      alert("请填写名称、金额和下次扣款日");
      return;
    }

    const payload = {
      id: $("#fId").value || uid(),
      name,
      amount,
      currency: $("#fCurrency").value,
      cycle: $("#fCycle").value,
      nextRenew: next,
      category: $("#fCategory").value,
      trialEnd: $("#fTrial").value || "",
      cancelUrl: $("#fCancelUrl").value.trim(),
      note: $("#fNote").value.trim(),
      status: $("#fStatus").value,
      demo: false,
    };

    const idx = state.items.findIndex((s) => s.id === payload.id);
    if (idx >= 0) {
      payload.demo = state.items[idx].demo && false;
      // keep demo flag only if still demo and name unchanged? Clear demo on edit
      payload.demo = false;
      state.items[idx] = payload;
    } else {
      state.items.push(payload);
    }
    state.seeded = state.items.some((s) => s.demo);
    saveState(state);
    closeForm();
    render();
  });

  $("#btnDelete").addEventListener("click", () => {
    if (!editingId) return;
    if (!confirm("确定删除这条订阅？")) return;
    state.items = state.items.filter((s) => s.id !== editingId);
    simSelected.delete(editingId);
    state.seeded = state.items.some((s) => s.demo);
    saveState(state);
    closeForm();
    render();
  });

  $("#btnClearDemo").addEventListener("click", () => {
    state.items = state.items.filter((s) => !s.demo);
    state.seeded = false;
    simSelected.clear();
    saveState(state);
    render();
  });

  $("#filterCat").addEventListener("change", renderList);
  $("#filterStatus").addEventListener("change", renderList);
  $("#sortBy").addEventListener("change", renderList);

  $("#simToggle").addEventListener("click", () => {
    const panel = $("#simPanel");
    const body = $("#simBody");
    const open = panel.classList.toggle("is-open");
    $("#simToggle").setAttribute("aria-expanded", open ? "true" : "false");
    if (open) body.removeAttribute("hidden");
    else body.setAttribute("hidden", "");
  });

  $("#subList").addEventListener("click", (e) => {
    const check = e.target.closest("[data-sim]");
    if (check && e.target.matches("input[type=checkbox]")) {
      const id = check.getAttribute("data-sim");
      if (check.checked) simSelected.add(id);
      else simSelected.delete(id);
      renderSim();
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit && !e.target.closest("a")) {
      const id = edit.getAttribute("data-edit");
      const sub = state.items.find((s) => s.id === id);
      if (sub) openForm(sub);
    }
  });

  $("#subList").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      e.preventDefault();
      const id = edit.getAttribute("data-edit");
      const sub = state.items.find((s) => s.id === id);
      if (sub) openForm(sub);
    }
  });

  $("#btnExport").addEventListener("click", () => {
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items: state.items }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "subwake-backup-" + todayStr() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const items = Array.isArray(data) ? data : data.items;
        if (!Array.isArray(items)) throw new Error("格式不对");
        if (!confirm("导入将覆盖当前全部订阅，确定？")) return;
        state.items = items.map((s) => ({
          id: s.id || uid(),
          name: String(s.name || "未命名"),
          amount: Number(s.amount) || 0,
          currency: s.currency === "USD" ? "USD" : "CNY",
          cycle: ["weekly", "monthly", "quarterly", "yearly"].includes(s.cycle)
            ? s.cycle
            : "monthly",
          nextRenew: s.nextRenew || todayStr(),
          category: s.category || "其他",
          trialEnd: s.trialEnd || "",
          cancelUrl: s.cancelUrl || "",
          note: s.note || "",
          status: s.status === "cancelled" ? "cancelled" : "active",
          demo: !!s.demo,
        }));
        state.seeded = state.items.some((s) => s.demo);
        simSelected.clear();
        saveState(state);
        closeBackup();
        render();
      } catch {
        alert("导入失败：JSON 格式不正确");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  render();
})();

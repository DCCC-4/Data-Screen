/*
  组编号：2
  组长：高乐霞（学号：2024212408；负责项目统筹、技术方案制定、全部代码开发与交互视觉优化）
  组员：岳林（学号：2023212598；负责数据口径梳理、数据清洗补齐、结果核验与展示视频制作）
  用途：中国人工智能算法提供商数据大屏最终交付逻辑
*/
(function () {
  const teamInfo = {
    group: "组编号：2",
    members: [
      {
        role: "组长",
        name: "高乐霞",
        studentId: "2024212408",
        task: "负责项目整体统筹与进度管理，完成数据大屏的整体架构设计、技术方案制定及全部代码开发；负责各功能模块的搭建与整合，实现数据筛选、联动分析等交互功能，并持续优化页面布局与视觉呈现效果。",
      },
      {
        role: "组员",
        name: "岳林",
        studentId: "2023212598",
        task: "负责数据口径与指标体系的梳理和统一，完成原始数据的清洗、去重、标准化处理及缺失字段补全；负责分析结果与可视化数据的核验，确保数据准确性、完整性和展示逻辑的一致性；同时负责成果展示视频的脚本整理、素材整合与后期制作。",
      },
    ],
  };
  const allFacts = window.COMPACT_FACTS || [];
  const details = window.RECORD_DETAILS || {};
  let facts = allFacts;
  const fmt = new Intl.NumberFormat("zh-CN");
  const globalFirstMonthBySubject = new Map();
  const globalFirstQueueBySubject = new Map();
  const globalFirstRowBySubject = new Map();
  allFacts.forEach((row) => {
    const subject = row["主体主键"];
    const month = row["备案月份"];
    if (subject && month && (!globalFirstMonthBySubject.has(subject) || month < globalFirstMonthBySubject.get(subject))) {
      globalFirstMonthBySubject.set(subject, month);
    }
    const queue = row["发布队列"];
    const order = Number.isFinite(Number(row["备案月份序号"])) ? Number(row["备案月份序号"]) : 0;
    if (subject && queue) {
      const current = globalFirstQueueBySubject.get(subject);
      if (!current || order < current.order || (order === current.order && String(queue).localeCompare(String(current.queue), "zh-CN") < 0)) {
        globalFirstQueueBySubject.set(subject, { queue, order, month });
        globalFirstRowBySubject.set(subject, row);
      }
    }
  });
  const filterState = {
    monthStart: "",
    monthEnd: "",
    listType: "",
    province: "",
    city: "",
    category: "",
    tech: "",
    industry: "",
    carrier: "",
  };
  let activeIndustryLevel = "行业一级";

  const by = (key) => {
    const result = new Map();
    facts.forEach((row) => {
      const value = row[key] || "待核验";
      result.set(value, (result.get(value) || 0) + 1);
    });
    return [...result.entries()].sort((a, b) => b[1] - a[1]);
  };

  const uniq = (key) => new Set(facts.map((row) => row[key]).filter(Boolean)).size;
  const missing = (key) => facts.filter((row) => !row[key]).length;

  const topRows = (key, limit = 10) => by(key).slice(0, limit);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const pct = (part, total) => total ? `${((part / total) * 100).toFixed(1)}%` : "0.0%";
  const validGeoLevels = new Set(["高", "中"]);
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const isUsableSubjectValue = (value) => value && value !== "待核验" && value !== "缺失";

  function canonicalSubjectCounts(rows, key, limit = 10) {
    const subjects = new Map();
    rows.forEach((row) => {
      const subject = row["主体主键"];
      if (!subject) return;
      if (!subjects.has(subject)) subjects.set(subject, []);
      subjects.get(subject).push(row);
    });
    const buckets = new Map();
    subjects.forEach((rows, subject) => {
      const ordered = rows.slice().sort((a, b) =>
        (number(b["备案月份序号"]) || 0) - (number(a["备案月份序号"]) || 0) || number(b.id) - number(a.id),
      );
      const selected = ordered.find((row) => isUsableSubjectValue(row[key]));
      const name = selected?.[key] || (ordered.some((row) => row[key] === "缺失") ? "缺失" : "待核验");
      if (!buckets.has(name)) buckets.set(name, new Set());
      buckets.get(name).add(subject);
    });
    return [...buckets.entries()]
      .map(([name, subjects]) => [name, subjects.size])
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function subjectCountBy(key, limit = 10) {
    return canonicalSubjectCounts(facts, key, limit);
  }

  function multiValueSubjectCountBy(key, limit = 10) {
    const buckets = new Map();
    facts.forEach((row) => {
      const name = row[key] || "待核验";
      const subject = row["主体主键"];
      if (!subject) return;
      if (!buckets.has(name)) buckets.set(name, new Set());
      buckets.get(name).add(subject);
    });
    return [...buckets.entries()]
      .map(([name, subjects]) => [name, subjects.size])
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function validCount(key) {
    return facts.filter((row) => row[key]).length;
  }

  function detailMissing(key) {
    const activeIds = new Set(facts.map((row) => String(row.id)));
    return Object.entries(details).filter(([id, detail]) => activeIds.has(id) && !detail[key]).length;
  }

  function renderSampleMeta(id, key, unit = "条记录") {
    const valid = validCount(key);
    const missingCount = facts.length - valid;
    document.getElementById(id).textContent =
      `有效样本 ${fmt.format(valid)} ${unit} · 待核验 ${fmt.format(missingCount)} 条（${pct(missingCount, facts.length)}）`;
  }

  function subjectGeoRows() {
    const subjects = new Map();
    facts.forEach((row) => {
      const subject = row["主体主键"];
      const lon = number(row["经度"]);
      const lat = number(row["纬度"]);
      if (!subject || !validGeoLevels.has(row["坐标置信等级"])) return;
      if (lon === null || lat === null || lon < 73 || lon > 136 || lat < 18 || lat > 54) return;
      const order = number(row["备案月份序号"]) || 0;
      const current = subjects.get(subject);
      if (!current || order > current.order || (order === current.order && number(row.id) > current.id)) {
        subjects.set(subject, {
          subject,
          province: row["省份"] || "待核验",
          city: row["城市"] || "待核验",
          lon,
          lat,
          order,
          id: number(row.id) || 0,
        });
      }
    });
    return [...subjects.values()];
  }

  function geoConcentration() {
    const rows = subjectCountBy("省份", Number.MAX_SAFE_INTEGER);
    const total = uniq("主体主键") || 1;
    const share = (count) => count / total;
    return {
      cr3: rows.slice(0, 3).reduce((sum, [, count]) => sum + share(count), 0),
      cr5: rows.slice(0, 5).reduce((sum, [, count]) => sum + share(count), 0),
      hhi: rows.reduce((sum, [, count]) => sum + (share(count) * 100) ** 2, 0),
    };
  }

  function renderKpis() {
    const latestMonth = facts.reduce((max, row) => (row["备案月份"] > max ? row["备案月份"] : max), "");
    const latestNewSubjects = new Set(
      facts
        .filter((row) => globalFirstMonthBySubject.get(row["主体主键"]) === latestMonth)
        .map((row) => row["主体主键"])
        .filter(Boolean),
    ).size;
    const kpis = [
      ["备案记录", facts.length, "官方记录口径"],
      ["去重主体数", uniq("主体主键"), "按规范化企业名称去重"],
      ["去重算法数", uniq("算法主键"), "主体+算法名称去重"],
      ["覆盖省份", uniq("省份"), "中国大陆省级口径"],
      ["覆盖城市", uniq("城市"), "标准城市字段"],
      ["最新月主体", latestNewSubjects, `${latestMonth} 出现主体`],
    ];

    document.getElementById("kpiGrid").innerHTML = kpis
      .map(
        ([label, value, note]) =>
          `<article class="kpi-card"><span>${label}</span><strong>${fmt.format(value)}</strong><small>${note}</small></article>`,
      )
      .join("");
  }

  function renderMetricTiles() {
    const duplicateRows = facts.filter((row) => row["重复状态"] === "重复候选").length;
    const geoSubjects = subjectGeoRows();
    const subjectTotal = uniq("主体主键");
    const concentration = geoConcentration();
    const latestMonth = facts.reduce((max, row) => (row["备案月份"] > max ? row["备案月份"] : max), "");
    const listTypes = by("清单类型");
    const tiles = [
      ["深度合成备案", listTypes.find(([name]) => name === "深度合成")?.[1] || 0, "记录/条"],
      ["信息服务备案", listTypes.find(([name]) => name === "信息服务")?.[1] || 0, "记录/条"],
      ["地图有效主体", geoSubjects.length, `${pct(geoSubjects.length, subjectTotal)}覆盖率`],
      ["重复候选记录", duplicateRows, "仅标记不删除"],
      ["最新备案月份", latestMonth, "时间轴终点"],
      ["发布队列", uniq("发布队列"), "35 队列口径"],
      ["省域 CR3", `${(concentration.cr3 * 100).toFixed(1)}%`, "主体集中度"],
      ["省域 CR5", `${(concentration.cr5 * 100).toFixed(1)}%`, "主体集中度"],
    ];
    document.getElementById("metricTiles").innerHTML = tiles
      .map(([label, value, note]) => `<article class="metric-tile"><span>${label}</span><strong>${typeof value === "number" ? fmt.format(value) : value}</strong><small>${note}</small></article>`)
      .join("");
  }

  function renderScope() {
    const scopeItems = [
      ["官方口径", "保留 8008 条备案记录，重复候选只标记，不物理删除。"],
      ["时间口径", "备案月份已恢复为 YYYY-MM；发放日期仅作为原始发布日期说明。"],
      ["批次口径", "页面需解释 17 批课程背景、18 个批次文本标签、34 个联合批次和 35 个发布队列。"],
      ["地理口径", "省界使用本地中国省级 GeoJSON；城市圆点仅纳入高/中置信坐标，空间结论以省市主体汇总为准。"],
    ];
    document.getElementById("scopeList").innerHTML = scopeItems
      .map(([title, text]) => `<li><strong>${title}：</strong>${text}</li>`)
      .join("");
  }

  function monthlySeries() {
    const monthMap = new Map();
    facts.forEach((row) => {
      const month = row["备案月份"];
      if (!month) return;
      if (!monthMap.has(month)) monthMap.set(month, { month, records: 0, newSubjects: 0 });
      monthMap.get(month).records += 1;
    });
    const activeSubjects = new Set(facts.map((row) => row["主体主键"]).filter(Boolean));
    activeSubjects.forEach((subject) => {
      const month = globalFirstMonthBySubject.get(subject);
      if (monthMap.has(month)) monthMap.get(month).newSubjects += 1;
    });
    return [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  }

  function renderTrend() {
    const data = monthlySeries();
    const width = 1160;
    const height = 274;
    const pad = { top: 18, right: 26, bottom: 42, left: 44 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxValue = Math.max(...data.map((d) => Math.max(d.records, d.newSubjects)), 1);
    const step = chartW / data.length;
    const x = (i) => pad.left + i * step + step * 0.5;
    const y = (v) => pad.top + chartH - (v / maxValue) * chartH;
    const bars = data
      .map((d, i) => {
        const barH = chartH - (y(d.records) - pad.top);
        return `<rect class="record-bar" x="${x(i) - step * 0.32}" y="${y(d.records)}" width="${Math.max(3, step * 0.64)}" height="${barH}" rx="3"></rect>`;
      })
      .join("");
    const points = data.map((d, i) => `${x(i)},${y(d.newSubjects)}`).join(" ");
    const circles = data
      .map((d, i) => `<circle class="subject-point" cx="${x(i)}" cy="${y(d.newSubjects)}" r="4"><title>${d.month} 新增主体 ${d.newSubjects}，备案记录 ${d.records}</title></circle>`)
      .join("");
    const monthLabels = data
      .filter((_, i) => i % Math.ceil(data.length / 8) === 0 || i === data.length - 1)
      .map((d, i, arr) => {
        const idx = data.findIndex((item) => item.month === d.month);
        const anchor = i === arr.length - 1 ? "end" : "middle";
        return `<text class="axis-label" x="${x(idx)}" y="${height - 14}" text-anchor="${anchor}">${d.month}</text>`;
      })
      .join("");
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => {
        const gy = pad.top + chartH * ratio;
        const label = Math.round(maxValue * (1 - ratio));
        return `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${gy}" y2="${gy}"></line><text class="axis-label" x="8" y="${gy + 4}">${fmt.format(label)}</text>`;
      })
      .join("");

    document.getElementById("trendChart").innerHTML = `
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img">
        ${grid}
        ${bars}
        <polyline class="subject-line" points="${points}"></polyline>
        ${circles}
        ${monthLabels}
      </svg>
      <div class="chart-legend">
        <span class="legend-item"><i class="legend-swatch blue"></i>备案记录数</span>
        <span class="legend-item"><i class="legend-swatch"></i>新增主体数</span>
      </div>
    `;
  }

  function renderMapPreview() {
    const geoJson = window.CHINA_PROVINCES;
    if (!geoJson?.features?.length) {
      document.getElementById("mapPreview").innerHTML = '<div class="empty-state">省级地图边界数据未加载</div>';
      return;
    }

    const mapContextFacts = allFacts.filter((row) => {
      if (filterState.monthStart && row["备案月份"] < filterState.monthStart) return false;
      if (filterState.monthEnd && row["备案月份"] > filterState.monthEnd) return false;
      if (filterState.listType && row["清单类型"] !== filterState.listType) return false;
      if (filterState.category && row["算法类别_LLM"] !== filterState.category) return false;
      if (filterState.tech && row["技术代际"] !== filterState.tech) return false;
      if (filterState.industry && row["行业一级"] !== filterState.industry) return false;
      if (filterState.carrier && row["产品载体类型"] !== filterState.carrier) return false;
      return true;
    });
    const provinceCounts = new Map(canonicalSubjectCounts(mapContextFacts, "省份", Number.MAX_SAFE_INTEGER));
    const provinceMax = Math.max(...provinceCounts.values(), 1);
    const provinceLevel = (count) => count ? Math.max(1, Math.ceil(Math.sqrt(count / provinceMax) * 5)) : 0;
    const width = 1680;
    const height = 945;
    const mapBounds = { lonMin: 73, lonMax: 136, latMin: 18, latMax: 54, x: 165, y: 28, w: 1290, h: 835 };
    const insetBounds = { lonMin: 105, lonMax: 124, latMin: 3, latMax: 24, x: 1390, y: 650, w: 218, h: 240 };
    const project = ([lon, lat], bounds = mapBounds) => [
      bounds.x + ((lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * bounds.w,
      bounds.y + ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * bounds.h,
    ];
    const ringPath = (ring, bounds) => ring
      .map((point, index) => {
        const [px, py] = project(point, bounds);
        return `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ") + " Z";
    const geometryPath = (geometry, bounds = mapBounds) => {
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
      return polygons.map((polygon) => polygon.map((ring) => ringPath(ring, bounds)).join(" ")).join(" ");
    };

    const boundaryFeature = geoJson.features.find((feature) => !feature.properties?.name);
    const provinces = geoJson.features.filter((feature) => feature.properties?.name);
    const provincePaths = provinces.map((feature) => {
      const name = feature.properties.name;
      const count = provinceCounts.get(name) || 0;
      const selected = filterState.province === name;
      const noComparable = count === 0;
      return `<path class="map-province level-${provinceLevel(count)}${selected ? " selected" : ""}${noComparable ? " no-data" : ""}"
        d="${geometryPath(feature.geometry)}"
        role="button"
        tabindex="0"
        data-filter-key="province"
        data-filter-value="${escapeHtml(name)}"
        data-map-tooltip="${escapeHtml(`${name}｜${count ? `${fmt.format(count)} 个主体` : "无可比数据"}｜点击筛选`)}"
        aria-label="${escapeHtml(name)}：${count ? `${fmt.format(count)} 个主体，点击筛选` : "无可比数据，点击查看"}">
        <title>${name}：${count ? `${fmt.format(count)} 个主体` : "无可比数据"}${selected ? "（当前已选）" : "（点击筛选）"}</title>
      </path>`;
    }).join("");

    const cityMap = new Map();
    const geoSubjects = subjectGeoRows();
    geoSubjects.forEach((row) => {
      const { lon, lat, city } = row;
      if (!city || city === "待核验") return;
      if (!cityMap.has(city)) {
        cityMap.set(city, { city, lonSum: 0, latSum: 0, count: 0 });
      }
      const item = cityMap.get(city);
      item.lonSum += lon;
      item.latSum += lat;
      item.count += 1;
    });

    const cities = [...cityMap.values()]
      .map((item) => ({
        city: item.city,
        lon: item.lonSum / item.count,
        lat: item.latSum / item.count,
        count: item.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 28);

    const maxCount = Math.max(...cities.map((d) => d.count), 1);
    const labeledCities = new Set(["北京市", "广州市", "上海市", "深圳市", "杭州市", "成都市"]);
    const labelOffsets = {
      北京市: [24, -22, "start"],
      广州市: [-24, 34, "end"],
      上海市: [25, -11, "start"],
      深圳市: [22, 39, "start"],
      杭州市: [25, 27, "start"],
      成都市: [-24, -17, "end"],
    };
    const points = cities
      .map((d) => {
        const r = 7 + Math.sqrt(d.count / maxCount) * 15;
        const [cx, cy] = project([d.lon, d.lat]);
        const [labelDx, labelDy, anchor] = labelOffsets[d.city] || [r + 10, -10, "start"];
        const labelX = cx + labelDx;
        const labelY = cy + labelDy;
        const label = labeledCities.has(d.city)
          ? `<line class="map-label-line" x1="${cx}" y1="${cy}" x2="${labelX}" y2="${labelY + 3}"></line><text class="map-label" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${d.city}</text><text class="map-sublabel" x="${labelX}" y="${labelY + 22}" text-anchor="${anchor}">${fmt.format(d.count)} 个</text>`
          : "";
        return `<g class="map-city-marker" role="button" tabindex="0" data-filter-key="city" data-filter-value="${escapeHtml(d.city)}" data-map-tooltip="${escapeHtml(`${d.city}｜${fmt.format(d.count)} 个有效坐标主体｜点击筛选`)}">
          <circle class="map-city-halo" cx="${cx}" cy="${cy}" r="${r + 5}"></circle>
          <circle class="map-city-point" cx="${cx}" cy="${cy}" r="${r}">
            <title>${d.city}：${fmt.format(d.count)} 个有效坐标主体，点击筛选</title>
          </circle>
          ${label}
        </g>`;
      })
      .join("");
    const subjectTotal = uniq("主体主键");
    const mapSubjectTotal = new Set(mapContextFacts.map((row) => row["主体主键"]).filter(Boolean)).size || 1;
    const provinceRows = [...provinceCounts.entries()].sort((a, b) => b[1] - a[1]);
    const share = (count) => count / mapSubjectTotal;
    const concentration = {
      cr3: provinceRows.slice(0, 3).reduce((sum, [, count]) => sum + share(count), 0),
      cr5: provinceRows.slice(0, 5).reduce((sum, [, count]) => sum + share(count), 0),
      hhi: provinceRows.reduce((sum, [, count]) => sum + (share(count) * 100) ** 2, 0),
    };
    const southSeaPath = boundaryFeature
      ? `<path class="south-sea-line" d="${geometryPath(boundaryFeature.geometry, insetBounds)}"><title>南海诸岛边界示意</title></path>`
      : "";

    document.getElementById("mapPreview").innerHTML = `
      <div class="standard-map-stage">
        <svg class="map-overlay" viewBox="0 0 ${width} ${height}" role="img" aria-label="中国省级主体分层地图与重点城市圆点">
          <g class="province-layer">${provincePaths}</g>
          <g class="city-layer">${points}</g>
          <g class="south-sea-inset">
            <rect x="${insetBounds.x - 12}" y="${insetBounds.y - 14}" width="${insetBounds.w + 24}" height="${insetBounds.h + 28}" rx="5"></rect>
            ${southSeaPath}
            <text x="${insetBounds.x + 10}" y="${insetBounds.y + insetBounds.h + 8}">南海诸岛</text>
          </g>
        </svg>
      </div>
      <div class="map-hud">
        <span><b>CR3</b>${(concentration.cr3 * 100).toFixed(1)}%</span>
        <span><b>CR5</b>${(concentration.cr5 * 100).toFixed(1)}%</span>
        <span><b>HHI</b>${concentration.hhi.toFixed(0)}</span>
      </div>
      <div class="map-data-legend" aria-label="地图图例">
        <div><strong>省份主体数</strong><span class="province-ramp"><i></i><i></i><i></i><i></i><i></i></span><small>低 → 高</small></div>
        <div><strong>城市主体数</strong><span class="city-size"><i></i><i></i><i></i></span><small>圆圈越大，主体越多</small></div>
        <div><span class="no-data-swatch"></span><small>港澳台等无记录区域：无可比数据</small></div>
      </div>
      <p class="map-note"><strong>地图口径：</strong>省份颜色按主体去重计数；城市圆点仅纳入高/中置信坐标。点击省份或城市可联动筛选，重复点击已选省份可取消。</p>
      <p class="map-coverage">有效坐标主体 ${fmt.format(geoSubjects.length)} / ${fmt.format(subjectTotal)} · ${pct(geoSubjects.length, subjectTotal)}</p>
      <div class="map-tooltip" role="status" hidden></div>
    `;
  }

  function setupMapTooltip() {
    const map = document.getElementById("mapPreview");
    const hide = () => {
      const tooltip = map.querySelector(".map-tooltip");
      if (tooltip) tooltip.hidden = true;
    };
    map.addEventListener("pointerover", (event) => {
      const target = event.target.closest("[data-map-tooltip]");
      const tooltip = map.querySelector(".map-tooltip");
      if (!target || !tooltip) return;
      tooltip.textContent = target.dataset.mapTooltip;
      tooltip.hidden = false;
    });
    map.addEventListener("pointermove", (event) => {
      const tooltip = map.querySelector(".map-tooltip");
      if (!tooltip || tooltip.hidden) return;
      const rect = map.getBoundingClientRect();
      const x = Math.min(rect.width - tooltip.offsetWidth - 10, Math.max(10, event.clientX - rect.left + 14));
      const y = Math.min(rect.height - tooltip.offsetHeight - 10, Math.max(10, event.clientY - rect.top + 14));
      tooltip.style.transform = `translate(${x}px, ${y}px)`;
    });
    map.addEventListener("pointerout", (event) => {
      const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest("[data-map-tooltip]") : null;
      if (!next) hide();
    });
    map.addEventListener("focusin", (event) => {
      const target = event.target.closest("[data-map-tooltip]");
      const tooltip = map.querySelector(".map-tooltip");
      if (!target || !tooltip) return;
      tooltip.textContent = target.dataset.mapTooltip;
      tooltip.style.transform = "translate(14px, 90px)";
      tooltip.hidden = false;
    });
    map.addEventListener("focusout", hide);
  }

  function renderBars(id, rows, options = {}) {
    const max = Math.max(...rows.map(([, value]) => value), 1);
    const warnNames = new Set(options.warnNames || []);
    document.getElementById(id).innerHTML = rows
      .map(([name, value]) => {
        const pct = (value / max) * 100;
        const fillClass = warnNames.has(name) ? "bar-fill warn" : "bar-fill";
        const filterAttrs = options.filterKey
          ? ` role="button" tabindex="0" data-filter-key="${options.filterKey}" data-filter-value="${escapeHtml(name)}"`
          : "";
        return `<div class="bar-item${options.filterKey ? " interactive" : ""}"${filterAttrs} title="${name} ${fmt.format(value)} 条">
          <span class="name">${name}</span>
          <span class="bar-track"><span class="${fillClass}" style="width:${pct}%"></span></span>
          <span>${fmt.format(value)}</span>
        </div>`;
      })
      .join("");
  }

  function renderTechStack() {
    const techRows = by("技术代际");
    const colors = ["#42d6c5", "#4db6e9", "#e7b85a", "#ef776e", "#9caab5"];
    const total = techRows.reduce((sum, [, value]) => sum + value, 0) || 1;
    const rowHtml = techRows
      .map(([name, value], i) => {
        const pct = (value / total) * 100;
        const text = pct > 9 ? `${name} ${pct.toFixed(1)}%` : "";
        return `<span class="stack-segment" style="width:${pct}%;background:${colors[i % colors.length]}">${text}</span>`;
      })
      .join("");
    const legendHtml = techRows
      .map(([name, value], i) => `<span class="legend-item"><i class="legend-swatch" style="background:${colors[i % colors.length]}"></i>${name} ${fmt.format(value)}</span>`)
      .join("");
    document.getElementById("techStack").innerHTML = `<div class="stack-row">${rowHtml}</div><div class="stack-legend">${legendHtml}</div>`;
    renderSampleMeta("techMeta", "技术代际");
  }

  function renderQuality() {
    const qualityRows = [
      ["算法类别缺失", missing("算法类别_LLM")],
      ["技术代际缺失", missing("技术代际")],
      ["行业一级缺失", missing("行业一级")],
      ["坐标待核验", facts.filter((row) => row["坐标置信等级"] === "待核验").length],
    ];
    document.getElementById("qualityList").innerHTML = qualityRows
      .map(([label, count]) => {
        const pct = facts.length ? Math.round((count / facts.length) * 1000) / 10 : 0;
        return `<div class="bar-row"><label><span>${label}</span><span>${fmt.format(count)} 条 · ${pct}%</span></label><div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
      })
      .join("");
  }

  function setupTabs() {
    if (!document.querySelectorAll) return;
    const tabs = [...document.querySelectorAll("[data-view]")];
    const panels = [...document.querySelectorAll("[data-panel]")];
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const view = tab.dataset.view;
        tabs.forEach((item) => item.classList.toggle("active", item === tab));
        panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
      });
    });
  }

  function setupIndustryDrilldown() {
    const buttons = [...document.querySelectorAll("[data-industry-level]")];
    const render = (key) => {
      activeIndustryLevel = key;
      renderBars("industryBars", subjectCountBy(key, 8), { warnNames: ["待核验"] });
      const subjectTotal = uniq("主体主键");
      const validSubjects = new Set(
        facts.filter((row) => row[key] && row["主体主键"]).map((row) => row["主体主键"]),
      ).size;
      document.getElementById("industryMeta").textContent =
        `${key}有效主体 ${fmt.format(validSubjects)} / ${fmt.format(subjectTotal)} · 缺失 ${pct(subjectTotal - validSubjects, subjectTotal)}`;
    };
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => item.classList.toggle("active", item === button));
        render(button.dataset.industryLevel);
      });
    });
  }

  function renderIndustryDrilldown() {
    const buttons = [...document.querySelectorAll("[data-industry-level]")];
    buttons.forEach((item) => item.classList.toggle("active", item.dataset.industryLevel === activeIndustryLevel));
    renderBars("industryBars", subjectCountBy(activeIndustryLevel, 8), {
      warnNames: ["待核验"],
      filterKey: activeIndustryLevel === "行业一级" ? "industry" : "",
    });
    const subjectTotal = uniq("主体主键");
    const validSubjects = new Set(
      facts.filter((row) => row[activeIndustryLevel] && row["主体主键"]).map((row) => row["主体主键"]),
    ).size;
    document.getElementById("industryMeta").textContent =
      `${activeIndustryLevel}有效主体 ${fmt.format(validSubjects)} / ${fmt.format(subjectTotal)} · 缺失 ${pct(subjectTotal - validSubjects, subjectTotal)}`;
  }

  function purposeThemeData() {
    const themes = [
      ["内容创作", /生成|创作|文案|图像|视频|音频|绘画|素材|编辑/],
      ["智能客服", /客服|咨询|问答|回答|对话|交互/],
      ["营销电商", /营销|广告|推荐|电商|商品|销售|直播/],
      ["办公知识", /办公|文档|知识|总结|检索|搜索|会议|翻译/],
      ["教育学习", /教育|学习|教学|题目|课程|作业|考试/],
      ["金融风控", /金融|银行|证券|保险|信贷|风控|投资/],
      ["医疗健康", /医疗|健康|诊断|病历|药|医生|患者/],
      ["安全治理", /安全|审核|检测|识别|风险|合规|治理/],
    ];
    const counts = new Map(themes.map(([name]) => [name, 0]));
    let valid = 0;
    const activeIds = new Set(facts.map((row) => String(row.id)));
    Object.entries(details).forEach(([id, detail]) => {
      if (!activeIds.has(id)) return;
      const text = detail["主要用途"];
      if (!text) return;
      valid += 1;
      themes.forEach(([name, pattern]) => {
        if (pattern.test(text)) counts.set(name, counts.get(name) + 1);
      });
    });
    return {
      valid,
      rows: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    };
  }

  function renderPurposeThemes() {
    const data = purposeThemeData();
    const max = Math.max(...data.rows.map(([, value]) => value), 1);
    document.getElementById("purposeThemes").innerHTML = data.rows.slice(0, 6)
      .map(([name, value]) => `
        <div class="theme-item">
          <div><strong>${name}</strong><span>${fmt.format(value)} 条 · ${pct(value, data.valid)}</span></div>
          <span class="theme-track"><i style="width:${(value / max) * 100}%"></i></span>
        </div>
      `)
      .join("");
    document.getElementById("purposeMeta").textContent =
      `有效主要用途 ${fmt.format(data.valid)} 条；一条记录可命中多个主题，因此占比之和可能超过 100%。`;
  }

  function representativeCases(limit = 3) {
    const candidates = facts
      .map((row) => ({ row, detail: details[String(row.id)] }))
      .filter(({ detail }) => detail?.["主要用途"] && detail?.["算法名称"] && detail?.["企业名称"])
      .sort((a, b) => b.detail["主要用途"].length - a.detail["主要用途"].length);
    const selected = [];
    const categories = new Set();
    const companies = new Set();
    candidates.forEach((item) => {
      if (selected.length >= limit) return;
      const category = item.row["算法类别_LLM"] || "待核验";
      const company = item.detail["企业名称"];
      if (companies.has(company)) return;
      if (categories.has(category) && selected.length < 4) return;
      selected.push(item);
      categories.add(category);
      companies.add(company);
    });
    return selected;
  }

  function renderCaseCards() {
    const cases = representativeCases();
    document.getElementById("caseCards").innerHTML = cases
      .map(({ row, detail }) => `
        <button class="case-card" type="button" data-case-id="${row.id}">
          <span>${escapeHtml(row["算法类别_LLM"] || "待核验")} · ${escapeHtml(row["备案月份"])}</span>
          <strong>${escapeHtml(detail["算法名称"])}</strong>
          <small>${escapeHtml(detail["企业名称"])}</small>
          <p>${escapeHtml(detail["主要用途"])}</p>
        </button>
      `)
      .join("");
  }

  function setupDetailDrawer() {
    const drawer = document.getElementById("detailDrawer");
    const content = document.getElementById("drawerContent");
    const title = document.getElementById("drawerTitle");
    const close = () => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("drawer-open");
    };
    document.addEventListener("click", (event) => {
      const card = event.target.closest("[data-case-id]");
      if (card) {
        const row = facts.find((item) => String(item.id) === card.dataset.caseId);
        const detail = details[card.dataset.caseId];
        if (!row || !detail) return;
        title.textContent = detail["算法名称"] || "案例详情";
        const fields = [
          ["企业名称", detail["企业名称"]],
          ["应用产品", detail["应用产品"]],
          ["算法类别", row["算法类别_LLM"]],
          ["技术代际", row["技术代际"]],
          ["企业角色", row["企业角色"]],
          ["行业", [row["行业一级"], row["行业二级"], row["行业三级"]].filter(Boolean).join(" / ")],
          ["地域", [row["省份"], row["城市"], row["县区"]].filter(Boolean).join(" / ")],
          ["备案批次", row["发布队列"]],
          ["发放日期", detail["发放日期"]],
          ["坐标质量", detail["坐标置信等级"]],
        ];
        content.innerHTML = `
          <section class="drawer-purpose">
            <span>主要用途</span>
            <p>${escapeHtml(detail["主要用途"] || "暂无说明")}</p>
          </section>
          <dl>${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value || "待核验")}</dd></div>`).join("")}</dl>
          <p class="drawer-boundary">案例用于说明备案应用场景，不代表企业能力排名或产品效果评价。</p>
        `;
        drawer.classList.add("open");
        drawer.setAttribute("aria-hidden", "false");
        document.body.classList.add("drawer-open");
        return;
      }
      if (event.target.closest("[data-close-drawer]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function renderReleaseRhythm() {
    const rows = [...new Map(facts.map((row) => {
      const id = row["发布队列"] || `${row["联合批次"] || "待核验"}-${row["备案月份"] || ""}`;
      return [id, {
        id,
        month: row["备案月份"] || "待核验",
        batch: row["联合批次"] || row["批次序号"] || "待核验",
        type: row["清单类型"] || "待核验",
        order: number(row["备案月份序号"]) || 0,
      }];
    })).values()].sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id), "zh-CN"));
    const countMap = new Map();
    facts.forEach((row) => {
      const id = row["发布队列"] || `${row["联合批次"] || "待核验"}-${row["备案月份"] || ""}`;
      countMap.set(id, (countMap.get(id) || 0) + 1);
    });
    const max = Math.max(...[...countMap.values()], 1);
    const width = 1160;
    const height = 270;
    const pad = { top: 16, right: 22, bottom: 42, left: 44 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const step = chartW / Math.max(rows.length, 1);
    const bars = rows.map((row, i) => {
      const value = countMap.get(row.id) || 0;
      const barH = (value / max) * chartH;
      const x = pad.left + i * step + step * 0.18;
      const y = pad.top + chartH - barH;
      const cls = row.type === "深度合成" ? "rhythm-bar deep" : "rhythm-bar service";
      return `<rect class="${cls}" x="${x}" y="${y}" width="${Math.max(4, step * 0.64)}" height="${barH}" rx="3"><title>${row.month} ${row.batch} ${row.type}：${fmt.format(value)}条</title></rect>`;
    }).join("");
    const labels = rows
      .filter((_, i) => i % Math.ceil(rows.length / 9) === 0 || i === rows.length - 1)
      .map((row, i, arr) => {
        const idx = rows.findIndex((item) => item.id === row.id);
        const x = pad.left + idx * step + step * 0.5;
        return `<text class="axis-label" x="${x}" y="${height - 14}" text-anchor="${i === arr.length - 1 ? "end" : "middle"}">${row.month}</text>`;
      })
      .join("");
    const grid = [0, 0.5, 1].map((ratio) => {
      const y = pad.top + chartH * ratio;
      return `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}"></line>`;
    }).join("");
    document.getElementById("releaseRhythm").innerHTML = `
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img">
        ${grid}${bars}${labels}
      </svg>
      <div class="chart-legend">
        <span class="legend-item"><i class="legend-swatch deep"></i>深度合成</span>
        <span class="legend-item"><i class="legend-swatch service"></i>信息服务</span>
        <span>18个批次标签 / 34个联合批次 / 35个发布队列</span>
      </div>
    `;
  }

  function renderStructureEvolution() {
    const years = [...new Set(facts.map((row) => row["备案月份"]?.slice(0, 4)).filter(Boolean))].sort();
    const rows = years.map((year) => {
      const yearRows = facts.filter((row) => row["备案月份"]?.startsWith(year));
      const categoryValid = yearRows.filter((row) => row["算法类别_LLM"]);
      const techValid = yearRows.filter((row) => row["技术代际"]);
      return {
        year,
        categoryShare: categoryValid.length
          ? categoryValid.filter((row) => row["算法类别_LLM"] === "内容生成").length / categoryValid.length
          : 0,
        g4Share: techValid.length
          ? techValid.filter((row) => row["技术代际"] === "G4").length / techValid.length
          : 0,
        records: yearRows.length,
      };
    });
    const width = 1160;
    const height = 250;
    const pad = { top: 24, right: 50, bottom: 44, left: 54 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const x = (index) => pad.left + (chartW / Math.max(rows.length - 1, 1)) * index;
    const y = (value) => pad.top + chartH - value * chartH;
    const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const gy = y(ratio);
      return `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${gy}" y2="${gy}"></line><text class="axis-label" x="8" y="${gy + 4}">${Math.round(ratio * 100)}%</text>`;
    }).join("");
    const series = [
      { name: "内容生成占比", className: "category-evolution-line", values: rows.map((row) => row.categoryShare) },
      { name: "G4占比", className: "tech-evolution-line", values: rows.map((row) => row.g4Share) },
    ];
    const lines = series.map((item) => {
      const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
      const dots = item.values.map((value, index) =>
        `<circle class="${item.className}-point" cx="${x(index)}" cy="${y(value)}" r="5"><title>${rows[index].year} ${item.name} ${(value * 100).toFixed(1)}%，${fmt.format(rows[index].records)}条记录</title></circle>`,
      ).join("");
      return `<polyline class="${item.className}" points="${points}"></polyline>${dots}`;
    }).join("");
    const labels = rows.map((row, index) =>
      `<text class="axis-label" x="${x(index)}" y="${height - 14}" text-anchor="middle">${row.year}</text>`,
    ).join("");
    document.getElementById("structureEvolution").innerHTML = `
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img">${grid}${lines}${labels}</svg>
      <div class="chart-legend">
        <span class="legend-item"><i class="legend-swatch category-evolution"></i>内容生成占有效分类样本</span>
        <span class="legend-item"><i class="legend-swatch tech-evolution"></i>G4占有效技术代际样本</span>
      </div>
    `;
  }

  function renderStructureInsights() {
    const subjectTotal = uniq("主体主键");
    const topProvince = subjectCountBy("省份", 1)[0] || ["待核验", 0];
    const topIndustry = subjectCountBy("行业一级", 1)[0] || ["待核验", 0];
    const missingIndustry = missing("行业一级");
    const missingProduct = detailMissing("应用产品");
    const items = [
      ["双清单节奏", `页面按35个发布队列展示备案节奏，同时保留课程背景17批次与数据文本18批次标签的差异说明。`],
      ["区域集中", `${topProvince[0]}主体数最高，约占主体口径 ${pct(topProvince[1], subjectTotal)}，后续建议在省域层面解释创新资源集聚。`],
      ["行业结构", `${topIndustry[0]}为当前行业一级最高项；行业一级缺失 ${fmt.format(missingIndustry)} 条，正式结论需标注“待核验”比例。`],
      ["产品字段", `应用产品缺失 ${fmt.format(missingProduct)} 条，载体结构适合做趋势提示，不适合单独作为强结论。`],
    ];
    document.getElementById("structureInsights").innerHTML = items
      .map(([title, text]) => `<li><strong>${title}</strong><span>${text}</span></li>`)
      .join("");
  }

  const forecastScenarios = {
    cautious: { name: "谨慎", color: "#e7b85a", queues: 7, multiplier: 0.8 },
    baseline: { name: "基准", color: "#35f2e2", queues: 9, multiplier: 1 },
    positive: { name: "积极", color: "#6bbdff", queues: 11, multiplier: 1.2 },
  };
  let activeForecastScenario = "baseline";

  function releaseQueueSeries() {
    const queueMap = new Map();
    facts.forEach((row) => {
      const queue = row["发布队列"];
      if (!queue || queueMap.has(queue)) return;
      queueMap.set(queue, {
        queue,
        month: row["备案月份"] || "",
        order: number(row["备案月份序号"]) || 0,
        newSubjects: 0,
      });
    });
    const activeSubjects = new Set(facts.map((row) => row["主体主键"]).filter(Boolean));
    activeSubjects.forEach((subject) => {
      const first = globalFirstQueueBySubject.get(subject);
      if (first && queueMap.has(first.queue)) queueMap.get(first.queue).newSubjects += 1;
    });
    return [...queueMap.values()].sort((a, b) =>
      a.order - b.order || String(a.queue).localeCompare(String(b.queue), "zh-CN"),
    );
  }

  function regression(values) {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, value) => sum + value, 0) / Math.max(n, 1);
    const numerator = values.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0);
    const denominator = values.reduce((sum, _, index) => sum + (index - xMean) ** 2, 0) || 1;
    return { intercept: yMean - (numerator / denominator) * xMean, slope: numerator / denominator };
  }

  function modelPredictions(model, train, count) {
    const recent = train.slice(-6);
    const recentMean = recent.reduce((sum, value) => sum + value, 0) / Math.max(recent.length, 1);
    const longMean = train.slice(-12).reduce((sum, value) => sum + value, 0) / Math.max(train.slice(-12).length, 1);
    if (model === "mean") return Array.from({ length: count }, () => Math.max(0, recentMean));
    if (model === "linear") {
      const window = train.slice(-12);
      const fit = regression(window);
      return Array.from({ length: count }, (_, index) =>
        Math.max(0, fit.intercept + fit.slope * (window.length + index)),
      );
    }
    return Array.from({ length: count }, (_, index) =>
      Math.max(0, recentMean * Math.exp(-0.055 * (index + 1)) + longMean * 0.22),
    );
  }

  function errorMetrics(actual, predicted) {
    const errors = actual.map((value, index) => value - predicted[index]);
    const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / Math.max(errors.length, 1);
    const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / Math.max(errors.length, 1));
    const smape = actual.reduce((sum, value, index) => {
      const denominator = Math.abs(value) + Math.abs(predicted[index]);
      return sum + (denominator ? (2 * Math.abs(value - predicted[index])) / denominator : 0);
    }, 0) / Math.max(actual.length, 1);
    return { mae, rmse, smape };
  }

  function forecastAnalysis() {
    const rows = releaseQueueSeries();
    const increments = rows.map((row) => row.newSubjects);
    const subjectCount = uniq("主体主键");
    const positiveQueues = increments.filter((value) => value > 0).length;
    const sufficient = subjectCount >= 30 && positiveQueues >= 6 && increments.length >= 12;
    const testSize = increments.length >= 12 ? 6 : Math.max(3, Math.floor(increments.length * 0.25));
    const train = increments.slice(0, -testSize);
    const actual = increments.slice(-testSize);
    const models = [
      { id: "mean", name: "近6发布月均值" },
      { id: "linear", name: "线性趋势" },
      { id: "saturation", name: "饱和衰减对照" },
    ].map((model) => {
      const predicted = modelPredictions(model.id, train, testSize);
      return { ...model, ...errorMetrics(actual, predicted), predicted };
    }).sort((a, b) => a.rmse - b.rmse);
    const best = models[0];
    const futureQueueValues = modelPredictions(best.id, increments, 12);
    const perQueue = futureQueueValues.reduce((sum, value) => sum + value, 0) / futureQueueValues.length;
    return { rows, increments, models, best, perQueue, testSize, subjectCount, positiveQueues, sufficient };
  }

  function scenarioProjection(key) {
    const analysis = forecastAnalysis();
    const scenario = forecastScenarios[key];
    const current = uniq("主体主键");
    const perQueue = analysis.perQueue * scenario.multiplier;
    return {
      ...analysis,
      scenario,
      current,
      perQueue,
      values: [
        current,
        Math.max(current, Math.round(current + perQueue * scenario.queues * 3)),
        Math.max(current, Math.round(current + perQueue * scenario.queues * 5)),
      ],
    };
  }

  function renderForecastChart() {
    const projection = scenarioProjection(activeForecastScenario);
    if (!projection.sufficient) {
      document.getElementById("forecastChart").innerHTML = `
        <div class="forecast-insufficient">
          <strong>当前筛选样本不足，不输出未来数量</strong>
          <p>当前为 ${fmt.format(projection.subjectCount)} 个主体、${fmt.format(projection.positiveQueues)} 个有效新增队列。至少需要 30 个主体和 6 个有效新增队列，避免小样本被机械外推。</p>
        </div>
        <div class="forecast-tags">
          <span>当前主体：${fmt.format(projection.current)}</span>
          <em>仅展示当前结构</em>
        </div>
      `;
      document.getElementById("forecastAssumption").textContent =
        "预测已暂停：当前筛选样本不足，调整筛选或重置后可查看三种情景。";
      return;
    }
    const history = projection.rows.slice(-8);
    let cumulative = projection.current - history.reduce((sum, row) => sum + row.newSubjects, 0);
    const historicalPoints = history.map((row) => {
      cumulative += row.newSubjects;
      return { label: row.month, value: cumulative, queue: row.queue };
    });
    const rows = [
      ...historicalPoints,
      { label: "2029-05", value: projection.values[1] },
      { label: "2031-05", value: projection.values[2] },
    ];
    const max = Math.max(...rows.map((row) => row.value), 1);
    const min = Math.min(...rows.map((row) => row.value), 0);
    const width = 1160;
    const height = 280;
    const pad = { top: 24, right: 44, bottom: 50, left: 74 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const x = (i) => pad.left + (chartW / Math.max(rows.length - 1, 1)) * i;
    const y = (v) => pad.top + chartH - ((v - min) / Math.max(max - min, 1)) * chartH;
    const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const gy = pad.top + chartH * ratio;
      const value = Math.round(max - (max - min) * ratio);
      return `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${gy}" y2="${gy}"></line><text class="axis-label" x="10" y="${gy + 4}">${fmt.format(value)}</text>`;
    }).join("");
    const points = rows.map((row, index) => `${x(index)},${y(row.value)}`).join(" ");
    const dots = rows.map((row, index) =>
      `<circle cx="${x(index)}" cy="${y(row.value)}" r="${index >= rows.length - 2 ? 7 : 4}" fill="${projection.scenario.color}"><title>${row.queue ? `${row.queue} · ` : ""}${row.label}：${fmt.format(row.value)}个累计主体</title></circle>`,
    ).join("");
    const axis = rows.map((row, index) =>
      `<text class="axis-label" x="${x(index)}" y="${height - 16}" text-anchor="middle">${index < rows.length - 2 && index % 2 ? "" : row.label}</text>`,
    ).join("");
    document.getElementById("forecastChart").innerHTML = `
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img">
        ${grid}<polyline class="forecast-line" points="${points}" style="stroke:${projection.scenario.color}"></polyline>${dots}${axis}
      </svg>
      <div class="forecast-tags">
        <span><i style="background:${projection.scenario.color}"></i>2029：${fmt.format(projection.values[1])}</span>
        <span><i style="background:${projection.scenario.color}"></i>2031：${fmt.format(projection.values[2])}</span>
        <span>每队列约 ${fmt.format(Math.round(projection.perQueue))} 个新增主体</span>
        <em>情景值非事实值</em>
      </div>
    `;
    document.getElementById("forecastAssumption").textContent =
      `${projection.scenario.name}情景：每年 ${projection.scenario.queues} 个发布队列，增量系数 ${projection.scenario.multiplier.toFixed(1)}；${projection.best.name}回测最优，但队列波动较大，结果为低置信情景。`;
  }

  function setupForecastScenarios() {
    const buttons = [...document.querySelectorAll("[data-scenario]")];
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        activeForecastScenario = button.dataset.scenario;
        buttons.forEach((item) => item.classList.toggle("active", item === button));
        renderForecastChart();
        renderFinalInsights();
      });
    });
  }

  function optionValues(key) {
    return [...new Set(allFacts.map((row) => row[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
  }

  function fillSelect(id, values, allLabel) {
    const select = document.getElementById(id);
    select.innerHTML = `<option value="">${allLabel}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  }

  function setupGlobalFilters() {
    const months = optionValues("备案月份");
    fillSelect("filterMonthStart", months, "最早月份");
    fillSelect("filterMonthEnd", months, "最晚月份");
    fillSelect("filterListType", optionValues("清单类型"), "全部清单");
    fillSelect("filterProvince", optionValues("省份"), "全部省份");
    fillSelect("filterCity", optionValues("城市"), "全部城市");
    fillSelect("filterCategory", optionValues("算法类别_LLM"), "全部类别");
    fillSelect("filterTech", optionValues("技术代际"), "全部代际");
    fillSelect("filterIndustry", optionValues("行业一级"), "全部行业");
    fillSelect("filterCarrier", optionValues("产品载体类型"), "全部载体");
    const mapping = {
      filterMonthStart: "monthStart",
      filterMonthEnd: "monthEnd",
      filterListType: "listType",
      filterProvince: "province",
      filterCity: "city",
      filterCategory: "category",
      filterTech: "tech",
      filterIndustry: "industry",
      filterCarrier: "carrier",
    };
    Object.entries(mapping).forEach(([id, stateKey]) => {
      document.getElementById(id).addEventListener("change", (event) => {
        filterState[stateKey] = event.target.value;
        if (stateKey === "monthStart" && filterState.monthEnd && filterState.monthStart > filterState.monthEnd) {
          filterState.monthEnd = filterState.monthStart;
          document.getElementById("filterMonthEnd").value = filterState.monthEnd;
        }
        if (stateKey === "monthEnd" && filterState.monthStart && filterState.monthEnd < filterState.monthStart) {
          filterState.monthStart = filterState.monthEnd;
          document.getElementById("filterMonthStart").value = filterState.monthStart;
        }
        if (stateKey === "province") refreshCityOptions();
        applyFilters();
      });
    });
    document.getElementById("resetFilters").addEventListener("click", () => {
      Object.keys(filterState).forEach((key) => { filterState[key] = ""; });
      Object.keys(mapping).forEach((id) => { document.getElementById(id).value = ""; });
      refreshCityOptions();
      applyFilters();
    });
    document.getElementById("exportView").addEventListener("click", exportCurrentView);
    document.getElementById("openQuality").addEventListener("click", openQualityDrawer);
  }

  function refreshCityOptions() {
    const values = [...new Set(
      allFacts
        .filter((row) => !filterState.province || row["省份"] === filterState.province)
        .map((row) => row["城市"])
        .filter(Boolean),
    )].sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
    if (filterState.city && !values.includes(filterState.city)) filterState.city = "";
    fillSelect("filterCity", values, "全部城市");
    document.getElementById("filterCity").value = filterState.city;
  }

  function applyFilters() {
    facts = allFacts.filter((row) => {
      if (filterState.monthStart && row["备案月份"] < filterState.monthStart) return false;
      if (filterState.monthEnd && row["备案月份"] > filterState.monthEnd) return false;
      if (filterState.listType && row["清单类型"] !== filterState.listType) return false;
      if (filterState.province && row["省份"] !== filterState.province) return false;
      if (filterState.city && row["城市"] !== filterState.city) return false;
      if (filterState.category && row["算法类别_LLM"] !== filterState.category) return false;
      if (filterState.tech && row["技术代际"] !== filterState.tech) return false;
      if (filterState.industry && row["行业一级"] !== filterState.industry) return false;
      if (filterState.carrier && row["产品载体类型"] !== filterState.carrier) return false;
      return true;
    });
    renderDashboard();
  }

  function activeFilterLabels() {
    const labels = {
      monthStart: "起始",
      monthEnd: "结束",
      listType: "清单",
      province: "省份",
      city: "城市",
      category: "类别",
      tech: "代际",
      industry: "行业",
      carrier: "载体",
    };
    return Object.entries(filterState).filter(([, value]) => value).map(([key, value]) => `${labels[key]}：${value}`);
  }

  function updateFilterFeedback() {
    const labels = activeFilterLabels();
    document.getElementById("filterSummary").textContent =
      `${labels.length ? labels.join(" · ") : "全量数据"}｜${fmt.format(facts.length)} 条记录，${fmt.format(uniq("主体主键"))} 个主体`;
    const warning = document.getElementById("sampleWarning");
    if (!facts.length) {
      warning.hidden = false;
      warning.textContent = "当前筛选没有匹配数据，请调整条件或重置筛选。";
    } else if (facts.length < 50 || uniq("主体主键") < 30) {
      warning.hidden = false;
      warning.textContent = `当前样本较少：${fmt.format(facts.length)} 条记录、${fmt.format(uniq("主体主键"))} 个主体，比例和预测仅作提示。`;
    } else {
      warning.hidden = true;
    }
  }

  function exportCurrentView() {
    const header = ["id", "备案月份", "清单类型", "主体主键", "省份", "城市", "算法类别_LLM", "技术代际", "行业一级", "产品载体类型"];
    const rows = facts.map((row) => header.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","));
    const meta = `# 生成时间：${new Date().toLocaleString("zh-CN")}\n# 筛选条件：${activeFilterLabels().join("；") || "无"}\n# 统计口径：官方备案记录，主体指标按主体主键去重\n`;
    const blob = new Blob(["\ufeff", meta, header.join(","), "\n", rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `当前视图数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function setupChartLinkage() {
    const activate = (target) => {
      const key = target.dataset.filterKey;
      const value = target.dataset.filterValue;
      if (!key || !value || value === "待核验") return;
      filterState[key] = key === "province" && filterState[key] === value ? "" : value;
      const selectMap = {
        province: "filterProvince",
        city: "filterCity",
        category: "filterCategory",
        industry: "filterIndustry",
      };
      if (key === "province") refreshCityOptions();
      if (selectMap[key]) document.getElementById(selectMap[key]).value = filterState[key];
      applyFilters();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-filter-key]");
      if (target) activate(target);
    });
    document.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-filter-key]")) {
        event.preventDefault();
        activate(event.target);
      }
    });
  }

  function renderFinalInsights() {
    const subjectTotal = uniq("主体主键");
    const topProvince = subjectCountBy("省份", 1)[0] || ["无数据", 0];
    const topIndustry = subjectCountBy("行业一级", 1)[0] || ["无数据", 0];
    const latestMonth = facts.reduce((max, row) => row["备案月份"] > max ? row["备案月份"] : max, "");
    const latestNew = new Set(
      facts.filter((row) => globalFirstMonthBySubject.get(row["主体主键"]) === latestMonth).map((row) => row["主体主键"]),
    ).size;
    const projection = scenarioProjection(activeForecastScenario);
    const forecastText = projection.sufficient
      ? `${projection.scenario.name}情景下 2029 年约 ${fmt.format(projection.values[1])} 个、2031 年约 ${fmt.format(projection.values[2])} 个累计主体；结果依赖未来发布队列频率，不是事实值。`
      : `当前仅 ${fmt.format(projection.subjectCount)} 个主体、${fmt.format(projection.positiveQueues)} 个有效新增队列，未达到预测门槛；未来数量不作机械外推。`;
    const items = [
      ["1", "事实", "现状如何？", `当前筛选覆盖 ${fmt.format(facts.length)} 条备案记录、${fmt.format(subjectTotal)} 个去重主体；${topProvince[0]}主体最多，占 ${pct(topProvince[1], subjectTotal)}。`],
      ["2", "结构判断", "发展态势有什么特点？", `${latestMonth || "当前区间"}新增主体 ${fmt.format(latestNew)} 个；内容生成和 G4 在有效样本中占比较高，备案结构向生成式能力集中。`],
      ["3", "情景预测", "未来数量与地域如何？", forecastText],
      ["4", "结构判断", "有哪些短板与建议？", `${topIndustry[0]}为当前主体最多行业，但行业字段仍有 ${pct(missing("行业一级"), facts.length)} 缺失；建议优先完善数据标准，并结合外部基准审慎判断区域和行业短板。`],
    ];
    document.getElementById("finalInsights").innerHTML = items.map(([index, type, title, text]) => `
      <article><i>${index}</i><div><span class="evidence-tag">${type}</span><strong>${title}</strong><p>${text}</p></div></article>
    `).join("");
  }

  function qualityDrawerHtml() {
    const duplicateRows = allFacts.filter((row) => row["重复状态"] === "重复候选").length;
    const fieldUsage = [
      ["id", "追溯", "详情定位与导出，不单独形成统计结论"],
      ["批次", "图表", "与清单类型组成联合批次，展示发布节奏"],
      ["清单类型", "筛选/图表", "深度合成与信息服务结构比较"],
      ["备案月份", "筛选/趋势", "主时间轴和新增主体统计"],
      ["算法名称", "详情/去重", "构建算法主键并展示典型案例"],
      ["算法类别_原始", "质量控制", "保留官方原值，辅助核验统一分类"],
      ["算法类别_LLM", "筛选/图表", "统一算法类别结构与演进"],
      ["企业角色", "图表", "主体角色结构"],
      ["企业名称", "去重/详情", "规范化后形成主体口径"],
      ["应用产品", "图表/详情", "解析产品载体类型"],
      ["主要用途", "图表/详情", "多标签应用主题与案例说明"],
      ["发放日期", "口径", "保留原始发布日期，不作为主趋势轴"],
      ["注册资本_万元", "图表", "清洗后形成登记资本区间"],
      ["省份", "筛选/地图", "省级分层、集中度与地域预测"],
      ["城市", "筛选/地图", "城市圆点与城市排行"],
      ["县区", "详情", "用于案例空间定位，不作全屏独立排行"],
      ["行业一级", "筛选/图表", "总体行业结构"],
      ["行业二级", "图表", "行业层级钻取"],
      ["行业三级", "图表", "细分行业层级钻取"],
      ["经度", "地图", "高、中置信城市点位聚合"],
      ["纬度", "地图", "高、中置信城市点位聚合"],
      ["技术代际", "筛选/图表", "G1-G4结构与年度演进"],
    ];
    const fieldRows = fieldUsage.map(([field, use, note]) =>
      `<tr><th>${field}</th><td>${use}</td><td>${note}</td></tr>`,
    ).join("");
    return `
      <section class="quality-section"><h3>数据来源与范围</h3><p>主数据为国家网信办算法备案课程数据，保留 8008 条官方记录，时间范围为 2022-08 至 2026-05。2022 和 2026 为非完整年度。</p></section>
      <section class="quality-section"><h3>批次口径</h3><p>课程背景按 17 批表述；数据中存在 18 个批次文本标签、34 个清单类型×批次标识和 35 个发布队列。趋势图按发布队列与备案月份排序，不混用这些口径。</p></section>
      <section class="quality-section"><h3>记录与主体口径</h3><p>官方事实表不删除记录；${duplicateRows} 条重复候选仅标记。原始企业名称直接去重为 5333 家；名称规范化与同义合并后形成 5331 个主体。备案规模使用记录口径；地域、行业和资本按主体选择当前筛选内最新非缺失值形成单一归属；企业角色允许同一主体涉及多个角色，属于非互斥口径。</p></section>
      <section class="quality-section"><h3>地理口径</h3><p>省级边界来自阿里云 DataV 中国省级 GeoJSON 的本地冻结副本，包含 34 个省级区域和南海诸岛边界要素；城市圆点仅纳入高、中置信坐标并按主体去重。地图用于课程交互展示，不替代自然资源部标准地图；空间结论以省市主体汇总统计为准。</p></section>
      <section class="quality-section"><h3>分类与文本</h3><p>算法类别以算法类别_LLM为主，技术代际为统一版 G1-G4。用途主题采用关键词多标签，一条记录可命中多个主题。</p></section>
      <section class="quality-section"><h3>预测方法</h3><p>以主体首次出现的发布队列构建新增主体序列，比较均值、线性趋势和饱和衰减，使用末端 6 个发布队列留后回测。未来按每年 7、9、11 个队列形成情景值，不是事实值或置信区间。</p></section>
      <section class="quality-section"><h3>外部数据</h3><p>当前未接入人口、GDP、研发投入等外部权威基准，因此区域与行业判断仅描述备案数据内部结构，不推断政策、人才、算力或融资原因。</p></section>
      <section class="quality-section field-usage-section"><h3>22 个原始字段使用矩阵</h3><p>字段不必全部单独生成图表，但均用于分析、筛选、地图、详情、追溯或质量控制。</p><div class="field-table-wrap"><table class="field-usage-table"><thead><tr><th>字段</th><th>用途</th><th>说明</th></tr></thead><tbody>${fieldRows}</tbody></table></div></section>
      <section class="quality-section"><h3>当前筛选</h3><p>${escapeHtml(activeFilterLabels().join("；") || "无筛选")}。当前样本 ${fmt.format(facts.length)} 条记录、${fmt.format(uniq("主体主键"))} 个主体。</p></section>
    `;
  }

  function openQualityDrawer() {
    const drawer = document.getElementById("qualityDrawer");
    document.getElementById("qualityDrawerContent").innerHTML = qualityDrawerHtml();
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
  }

  function setupQualityDrawer() {
    const drawer = document.getElementById("qualityDrawer");
    const close = () => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("drawer-open");
    };
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-quality]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer.classList.contains("open")) close();
    });
  }

  function renderNoData() {
    const ids = [
      "kpiGrid", "trendChart", "mapPreview", "metricTiles", "provinceBars", "cityBars", "categoryBars",
      "techStack", "qualityList", "releaseRhythm", "structureEvolution", "industryBars", "carrierBars",
      "capitalBars", "roleBars", "structureInsights", "purposeThemes", "caseCards", "forecastChart",
      "modelBenchmark", "regionForecastBars", "weaknessMatrix", "recommendationList", "forecastMethod",
      "finalInsights",
    ];
    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.innerHTML = '<div class="empty-state">当前筛选无数据</div>';
    });
  }

  function renderDashboard() {
    updateFilterFeedback();
    if (!facts.length) {
      renderNoData();
      return;
    }
    renderKpis();
    renderMetricTiles();
    renderTrend();
    renderMapPreview();
    renderBars("provinceBars", subjectCountBy("省份", 10), { filterKey: "province" });
    renderBars("cityBars", subjectCountBy("城市", 10), { filterKey: "city" });
    renderBars("categoryBars", topRows("算法类别_LLM", 10), { warnNames: ["待核验"], filterKey: "category" });
    renderSampleMeta("categoryMeta", "算法类别_LLM");
    renderTechStack();
    renderQuality();
    renderScope();
    renderReleaseRhythm();
    renderStructureEvolution();
    renderIndustryDrilldown();
    renderBars("carrierBars", topRows("产品载体类型", 7), { warnNames: ["待核验"] });
    renderBars("capitalBars", subjectCountBy("注册资本区间", 10), { warnNames: ["待核验"] });
    renderBars("roleBars", multiValueSubjectCountBy("企业角色", 10), { warnNames: ["待核验"] });
    const roleSubjects = new Set(facts.map((row) => row["主体主键"]).filter(Boolean)).size;
    const roleMemberships = multiValueSubjectCountBy("企业角色", Number.MAX_SAFE_INTEGER).reduce((sum, [, value]) => sum + value, 0);
    document.getElementById("roleMeta").textContent =
      `涉及角色的主体 ${fmt.format(roleSubjects)} 个；角色归属 ${fmt.format(roleMemberships)} 次，同一主体可涉及多个角色，占比不互斥。`;
    renderStructureInsights();
    renderPurposeThemes();
    renderCaseCards();
    renderForecastChart();
    renderModelBenchmark();
    renderRegionForecast();
    renderWeaknessMatrix();
    renderRecommendations();
    renderForecastMethod();
    renderFinalInsights();
  }

  function renderModelBenchmark() {
    const analysis = forecastAnalysis();
    if (!analysis.sufficient) {
      document.getElementById("modelBenchmark").innerHTML =
        `<div class="forecast-insufficient compact"><strong>不执行模型比较</strong><p>${fmt.format(analysis.subjectCount)} 个主体、${fmt.format(analysis.positiveQueues)} 个有效新增队列未达到预测门槛。</p></div>`;
      return;
    }
    const lowConfidence = analysis.best.smape > 0.5;
    document.getElementById("modelBenchmark").innerHTML = analysis.models.map((model, index) => `
      <article class="model-card ${index === 0 ? "best" : ""}">
        <div><strong>${model.name}</strong>${index === 0 ? `<span>${lowConfidence ? "已选 · 低置信" : "已选"}</span>` : ""}</div>
        <p><b>MAE ${model.mae.toFixed(1)}</b><b>RMSE ${model.rmse.toFixed(1)}</b><b>sMAPE ${(model.smape * 100).toFixed(1)}%</b></p>
      </article>
    `).join("") + (lowConfidence ? '<p class="forecast-risk-note">发布队列增量波动较大，回测误差偏高；预测仅用于展示不同发布节奏下的情景范围。</p>' : "");
  }

  function provinceShareForecast() {
    const activeSubjects = new Set(facts.map((row) => row["主体主键"]).filter(Boolean));
    const all = [...activeSubjects].map((subject) => {
      const first = globalFirstRowBySubject.get(subject);
      return {
        month: first?.["备案月份"] || globalFirstMonthBySubject.get(subject) || "",
        province: first?.["省份"] || "待核验",
      };
    }).filter((row) => row.month);
    const recentMonths = [...new Set(all.map((row) => row.month))].sort().slice(-12);
    const recentSet = new Set(recentMonths);
    const totalCounts = new Map();
    const recentCounts = new Map();
    all.forEach((row) => {
      totalCounts.set(row.province, (totalCounts.get(row.province) || 0) + 1);
      if (recentSet.has(row.month)) recentCounts.set(row.province, (recentCounts.get(row.province) || 0) + 1);
    });
    const top = [...totalCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
    const total = all.length || 1;
    const recentTotal = [...recentCounts.values()].reduce((sum, value) => sum + value, 0) || 1;
    const rows = top.map((name) => {
      const current = (totalCounts.get(name) || 0) / total;
      const recent = (recentCounts.get(name) || 0) / recentTotal;
      return { name, current, projected: current * 0.65 + recent * 0.35 };
    });
    const topProjected = rows.reduce((sum, row) => sum + row.projected, 0);
    rows.push({
      name: "其他地区",
      current: 1 - rows.reduce((sum, row) => sum + row.current, 0),
      projected: Math.max(0, 1 - topProjected),
    });
    const projectedTotal = rows.reduce((sum, row) => sum + row.projected, 0) || 1;
    rows.forEach((row) => { row.projected /= projectedTotal; });
    return rows;
  }

  function renderRegionForecast() {
    if (filterState.province || filterState.city) {
      document.getElementById("regionForecastBars").innerHTML = `
        <div class="forecast-insufficient compact">
          <strong>当前已限定地域</strong>
          <p>省际份额预测在省份或城市筛选下不适用。清除地域筛选后可比较主要省份的当前份额与情景趋势。</p>
        </div>
      `;
      return;
    }
    const rows = provinceShareForecast();
    const analysis = forecastAnalysis();
    document.getElementById("regionForecastBars").innerHTML = rows.map((row) => `
      <div class="share-item">
        <strong>${row.name}</strong>
        <div><span style="width:${row.current * 100}%"></span>${analysis.sufficient ? `<i style="left:${row.projected * 100}%"></i>` : ""}</div>
        <small>${analysis.sufficient ? `${(row.current * 100).toFixed(1)}% → ${(row.projected * 100).toFixed(1)}%` : `${(row.current * 100).toFixed(1)}%`}</small>
      </div>
    `).join("") + `<p class="sample-meta">${analysis.sufficient
      ? "情景份额由当前主体份额与近 12 个发布月份新增份额加权，并归一化为 100%。"
      : "当前样本未达到预测门槛，仅展示现有主体的地域构成。"}</p>`;
  }

  function renderWeaknessMatrix() {
    const subjectTotal = uniq("主体主键");
    const top5 = subjectCountBy("省份", 5).reduce((sum, [, value]) => sum + value, 0);
    const g4 = by("技术代际").find(([name]) => name === "G4")?.[1] || 0;
    const coordinateRisk = facts.filter((row) => row["坐标置信等级"] === "待核验").length;
    const categoryRows = by("算法类别_LLM").filter(([name]) => name !== "待核验");
    const categoryTop3 = categoryRows.slice(0, 3).reduce((sum, [, value]) => sum + value, 0);
    const themes = purposeThemeData();
    const themeTop3 = themes.rows.slice(0, 3).reduce((sum, [, value]) => sum + value, 0);
    const themeHits = themes.rows.reduce((sum, [, value]) => sum + value, 0);
    const items = [
      ["区域集中度", pct(top5, subjectTotal), "关注｜内部结构", "Top5省份主体占比较高，但无外部经济与人口基准，不能直接判定区域发展失衡。"],
      ["G4结构", pct(g4, validCount("技术代际")), "优势｜内部结构", "有效技术代际样本中 G4 占比较高，显示当前备案结构明显偏向生成式能力。"],
      ["算法类别集中", pct(categoryTop3, validCount("算法类别_LLM")), "关注｜内部结构", "前三类别占比较高，应持续观察专业模型与基础能力的多样性。"],
      ["应用主题集中", pct(themeTop3, themeHits), "关注｜主题命中", "前三主题占全部主题命中次数的比重较高；该指标不等同于主体或产品市场份额。"],
      ["行业字段缺失", pct(missing("行业一级"), facts.length), "数据不足", "行业字段缺失会降低产业渗透结论的可信度。"],
      ["坐标待核验", pct(coordinateRisk, facts.length), "质量风险", "地图已排除待核验坐标，正式空间结论仍以主体省市汇总为准。"],
    ];
    document.getElementById("weaknessMatrix").innerHTML = items
      .map(([name, value, tag, note]) => `<article class="matrix-item"><strong>${name}</strong><b>${value}</b><span>${tag}</span><p>${note}</p></article>`)
      .join("");
  }

  function renderRecommendations() {
    const concentration = geoConcentration();
    const industryMissing = missing("行业一级");
    const categoryMissing = missing("算法类别_LLM");
    const productMissing = detailMissing("应用产品");
    const items = [
      ["P1", "完善公开数据标准", `行业缺失 ${pct(industryMissing, facts.length)}、分类缺失 ${pct(categoryMissing, facts.length)}、应用产品缺失 ${pct(productMissing, facts.length)}。`, "补充稳定主体标识、行业分类版本和产品字段，提高跨批次复算与政策研判可靠性。"],
      ["P1", "关注区域协同而非简单排名", `省域 CR3 ${(concentration.cr3 * 100).toFixed(1)}%、CR5 ${(concentration.cr5 * 100).toFixed(1)}%、HHI ${concentration.hhi.toFixed(0)}。`, "在当前备案口径下跟踪中西部新增主体份额，并结合人口、GDP、研发投入等外部基准后再判断区域短板。"],
      ["P2", "拓展专业行业应用", `信息技术服务业为主体数最高行业，应用主题主要集中在内容创作和智能客服。`, "鼓励制造、医疗、教育和公共服务等场景形成可复核案例，同时避免把备案数量直接解释为应用成效。"],
      ["P2", "保持技术结构多样性", `G4在有效技术代际样本中占 ${pct(by("技术代际").find(([name]) => name === "G4")?.[1] || 0, validCount("技术代际"))}。`, "在大模型扩张背景下持续观察专业模型、检测审核和安全治理能力，避免仅以生成式数量衡量技术进步。"],
    ];
    document.getElementById("recommendationList").innerHTML = items.map(([priority, title, evidence, action]) => `
      <article>
        <span>${priority}</span>
        <div><strong>${title}</strong><p><b>证据：</b>${evidence}</p><p><b>建议：</b>${action}</p></div>
      </article>
    `).join("");
  }

  function renderForecastMethod() {
    const analysis = forecastAnalysis();
    const adjustedSubjects = new Set(
      facts.filter((row) => row["重复状态"] !== "重复候选").map((row) => row["主体主键"]).filter(Boolean),
    ).size;
    document.getElementById("forecastMethod").innerHTML = `
      <article><strong>预测对象</strong><p>以主体主键首次出现的发布队列构建新增主体序列，避免同一主体多条备案重复累计。</p></article>
      <article><strong>模型选择</strong><p>比较近 6 个发布队列均值、线性趋势和饱和衰减对照；最后 ${analysis.testSize} 个发布队列留后回测，以 RMSE 最低模型作为基准。</p></article>
      <article><strong>情景连接</strong><p>将每发布队列新增主体估计与每年 7、9、11 个发布队列假设连接，形成谨慎、基准、积极情景。</p></article>
      <article><strong>敏感性与局限</strong><p>官方口径 ${fmt.format(uniq("主体主键"))} 个主体；排除重复候选记录后为 ${fmt.format(adjustedSubjects)} 个。少于 30 个主体或 6 个有效新增队列时暂停预测；其余情况下仍因政策节奏和队列波动仅作低置信情景研判。</p></article>
    `;
  }

  function setupClock() {
    const timeNode = document.getElementById("headerTime");
    const dateNode = document.getElementById("headerDate");
    const update = () => {
      const now = new Date();
      timeNode.textContent = new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      dateNode.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    };
    update();
    window.setInterval(update, 1000);
  }

  function setupCover() {
    document.getElementById("coverGroup").textContent = teamInfo.group;
    document.getElementById("coverMemberGrid").innerHTML = teamInfo.members.map((member, index) => `
      <article class="cover-member ${index === 0 ? "leader" : ""}">
        <span>${escapeHtml(member.role)}</span>
        <strong>${member.name ? escapeHtml(member.name) : '<i class="member-blank"></i>'}</strong>
        <small class="member-student">${member.studentId ? `学号：${escapeHtml(member.studentId)}` : '<i class="student-blank"></i>'}</small>
        <small class="member-task">${member.task ? `分工：${escapeHtml(member.task)}` : "分工：待填写"}</small>
      </article>
    `).join("");
    const cover = document.getElementById("coverScreen");
    document.body.classList.add("cover-open");
    document.getElementById("enterDashboard").addEventListener("click", () => {
      cover.classList.add("hidden");
      document.body.classList.remove("cover-open");
      window.setTimeout(() => cover.setAttribute("aria-hidden", "true"), 520);
    }, { once: true });
  }

  setupCover();
  setupClock();
  setupTabs();
  if (!allFacts.length) {
    document.body.insertAdjacentHTML("afterbegin", '<div class="data-error">数据资源未加载，请检查 <code>source/data/compact_facts.js</code>。</div>');
    return;
  }
  setupIndustryDrilldown();
  setupDetailDrawer();
  setupForecastScenarios();
  setupGlobalFilters();
  setupChartLinkage();
  setupMapTooltip();
  setupQualityDrawer();
  renderDashboard();
})();

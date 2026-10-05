class MomonGA extends ComicSource {
  name = "momon:GA";

  key = "momon_ga";

  version = "1.0.1";

  minAppVersion = "1.5.0";

  url = "https://raw.githubusercontent.com/ChopDream/venera-source-hub/main/momon.js";

  baseUrl = "https://momon-ga.com";

  settings = {
    imgHost: {
      title: "图片线路",
      type: "select",
      options: [
        { value: "z3", text: "线路 3（默认）" },
        { value: "z2", text: "线路 2（备用）" },
      ],
      default: "z3",
    },
  };

  get host() {
    return this.loadSetting("imgHost") || "z3";
  }

  postUrl(id) {
    return `${this.baseUrl}/${id}/`;
  }

  fixImg(url) {
    if (!url) return "";
    return url.replace(/https:\/\/z\d+\.momon-ga\.me\//, `https://${this.host}.momon-ga.me/`);
  }

  parseList(html) {
    const doc = new HtmlDocument(html);
    const comics = [];
    doc.querySelectorAll("a").forEach((a) => {
      const href = a.attributes["href"] || "";
      if (!/\/(fanzine|magazine|comic)\//.test(href)) return;
      const img = a.querySelector("img");
      if (!img) return;
      const span = a.querySelector("span");
      const title = (span ? span.text : img.attributes["alt"] || "").trim();
      const cover = this.fixImg(img.attributes["src"] || "");
      const id = href.replace(this.baseUrl, "").replace(/^\/+/, "").replace(/\/+$/, "");
      if (!title || !id) return;
      comics.push(new Comic({ id: id, title: title, cover: cover }));
    });
    return comics;
  }

  loadPage(url, page) {
    if (page === 1) return url;
    const base = url.endsWith("/") ? url.slice(0, -1) : url;
    return `${base}/page/${page}/`;
  }

  hasNext(html) {
    return new HtmlDocument(html).querySelector("a.nextpostslink") !== null;
  }

  listUrl(path, page) {
    const base = path === "latest" ? this.baseUrl : `${this.baseUrl}/${path}`;
    if (page === 1) return base;
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${b}/page/${page}/`;
  }

  explore = [
    {
      title: "momon:GA",
      type: "multiPartPage",
      load: async () => {
        const sections = [
          { title: "最新", path: "latest" },
          { title: "同人誌", path: "fanzine" },
          { title: "商業誌", path: "magazine" },
        ];
        const out = [];
        for (let s of sections) {
          const res = await Network.get(this.listUrl(s.path, 1), {});
          if (res.status !== 200) continue;
          const comics = this.parseList(res.body).slice(0, 30);
          if (comics.length === 0) continue;
          out.push({
            title: s.title,
            comics: comics,
            viewMore: { page: "category", attributes: { category: s.title, param: s.path } },
          });
        }
        return out;
      },
    },
  ];

  search = {
    load: async (keyword, options, page) => {
      let url =
        page === 1
          ? `${this.baseUrl}/?s=${encodeURIComponent(keyword)}`
          : `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(keyword)}`;
      if (options[0] === "rand") url += "&orderby=rand&order=desc";
      else if (options[0] === "title") url += "&orderby=title&order=asc";
      const res = await Network.get(url, {});
      if (res.status !== 200) throw "状态码错误：" + res.status;
      return { comics: this.parseList(res.body), maxPage: this.hasNext(res.body) ? page + 1 : page };
    },

    optionList: [
      {
        type: "select",
        options: ["date-最新发布", "rand-随机推荐", "title-按标题"],
        label: "排序",
      },
    ],
  };

  comic = {
    load: async (id) => {
      const res = await Network.get(this.postUrl(id), {});
      if (res.status !== 200) throw "状态码错误：" + res.status;
      const doc = new HtmlDocument(res.body);
      const h1 = doc.querySelector("h1");
      const title = h1 ? h1.text.trim() : id;
      let cover = "";
      let galleryId = "";
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.attributes["src"] || "";
        const m = src.match(/\/galleries\/(\d+)\/(\d+)\.webp$/);
        if (!m) return;
        if (!galleryId) {
          galleryId = m[1];
          cover = this.fixImg(src);
        }
      });
      const chapters = new Map();
      chapters.set("1", "全一話");
      const tags = {};
      const tagList = [];
      doc.querySelectorAll("a").forEach((a) => {
        const href = a.attributes["href"] || "";
        if (href.indexOf("/tag/") >= 0) {
          const t = a.text.trim();
          if (t && tagList.indexOf(t) < 0) tagList.push(t);
        }
      });
      if (tagList.length > 0) tags["標籤"] = tagList;
      return new ComicDetails({
        title: title,
        cover: cover,
        tags: tags,
        chapters: chapters,
        url: this.postUrl(id),
        subId: galleryId,
      });
    },

    loadEp: async (comicId, epId) => {
      const res = await Network.get(this.postUrl(comicId), {});
      if (res.status !== 200) throw "状态码错误：" + res.status;
      const doc = new HtmlDocument(res.body);
      let galleryId = "";
      const list = [];
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.attributes["src"] || "";
        const m = src.match(/\/galleries\/(\d+)\/(\d+)\.webp$/);
        if (!m) return;
        if (!galleryId) galleryId = m[1];
        if (m[1] !== galleryId) return;
        list.push({ n: parseInt(m[2]), url: this.fixImg(src) });
      });
      list.sort((a, b) => a.n - b.n);
      if (list.length === 0) throw "未找到圖片，站點結構可能已調整";
      return { images: list.map((x) => x.url) };
    },
  };

  category = {
    title: "momon:GA",
    parts: [
      {
        name: "分類",
        type: "fixed",
        categories: ["最新", "同人誌", "商業誌"],
        itemType: "category",
        categoryParams: ["latest", "fanzine", "magazine"],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const path = param || "latest";
      const res = await Network.get(this.listUrl(path, page), {});
      if (res.status !== 200) throw "状态码错误：" + res.status;
      return {
        comics: this.parseList(res.body),
        maxPage: this.hasNext(res.body) ? page + 1 : page,
      };
    },
  };
}

new MomonGA();


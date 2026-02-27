/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const N = globalThis, V = N.ShadowRoot && (N.ShadyCSS === void 0 || N.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, j = Symbol(), X = /* @__PURE__ */ new WeakMap();
let ot = class {
  constructor(t, e, s) {
    if (this._$cssResult$ = !0, s !== j) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (V && t === void 0) {
      const s = e !== void 0 && e.length === 1;
      s && (t = X.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && X.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const _t = (a) => new ot(typeof a == "string" ? a : a + "", void 0, j), lt = (a, ...t) => {
  const e = a.length === 1 ? a[0] : t.reduce((s, i, r) => s + ((n) => {
    if (n._$cssResult$ === !0) return n.cssText;
    if (typeof n == "number") return n;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + n + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(i) + a[r + 1], a[0]);
  return new ot(e, a, j);
}, gt = (a, t) => {
  if (V) a.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const s = document.createElement("style"), i = N.litNonce;
    i !== void 0 && s.setAttribute("nonce", i), s.textContent = e.cssText, a.appendChild(s);
  }
}, J = V ? (a) => a : (a) => a instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const s of t.cssRules) e += s.cssText;
  return _t(e);
})(a) : a;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: ft, defineProperty: vt, getOwnPropertyDescriptor: mt, getOwnPropertyNames: bt, getOwnPropertySymbols: yt, getPrototypeOf: $t } = Object, b = globalThis, K = b.trustedTypes, xt = K ? K.emptyScript : "", wt = b.reactiveElementPolyfillSupport, P = (a, t) => a, F = { toAttribute(a, t) {
  switch (t) {
    case Boolean:
      a = a ? xt : null;
      break;
    case Object:
    case Array:
      a = a == null ? a : JSON.stringify(a);
  }
  return a;
}, fromAttribute(a, t) {
  let e = a;
  switch (t) {
    case Boolean:
      e = a !== null;
      break;
    case Number:
      e = a === null ? null : Number(a);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(a);
      } catch {
        e = null;
      }
  }
  return e;
} }, dt = (a, t) => !ft(a, t), Z = { attribute: !0, type: String, converter: F, reflect: !1, useDefault: !1, hasChanged: dt };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), b.litPropertyMetadata ?? (b.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let w = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = Z) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const s = Symbol(), i = this.getPropertyDescriptor(t, s, e);
      i !== void 0 && vt(this.prototype, t, i);
    }
  }
  static getPropertyDescriptor(t, e, s) {
    const { get: i, set: r } = mt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(n) {
      this[e] = n;
    } };
    return { get: i, set(n) {
      const h = i?.call(this);
      r?.call(this, n), this.requestUpdate(t, h, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Z;
  }
  static _$Ei() {
    if (this.hasOwnProperty(P("elementProperties"))) return;
    const t = $t(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(P("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(P("properties"))) {
      const e = this.properties, s = [...bt(e), ...yt(e)];
      for (const i of s) this.createProperty(i, e[i]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [s, i] of e) this.elementProperties.set(s, i);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, s] of this.elementProperties) {
      const i = this._$Eu(e, s);
      i !== void 0 && this._$Eh.set(i, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const s = new Set(t.flat(1 / 0).reverse());
      for (const i of s) e.unshift(J(i));
    } else t !== void 0 && e.push(J(t));
    return e;
  }
  static _$Eu(t, e) {
    const s = e.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const s of e.keys()) this.hasOwnProperty(s) && (t.set(s, this[s]), delete this[s]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return gt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, e, s) {
    this._$AK(t, s);
  }
  _$ET(t, e) {
    const s = this.constructor.elementProperties.get(t), i = this.constructor._$Eu(t, s);
    if (i !== void 0 && s.reflect === !0) {
      const r = (s.converter?.toAttribute !== void 0 ? s.converter : F).toAttribute(e, s.type);
      this._$Em = t, r == null ? this.removeAttribute(i) : this.setAttribute(i, r), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const s = this.constructor, i = s._$Eh.get(t);
    if (i !== void 0 && this._$Em !== i) {
      const r = s.getPropertyOptions(i), n = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : F;
      this._$Em = i;
      const h = n.fromAttribute(e, r.type);
      this[i] = h ?? this._$Ej?.get(i) ?? h, this._$Em = null;
    }
  }
  requestUpdate(t, e, s, i = !1, r) {
    if (t !== void 0) {
      const n = this.constructor;
      if (i === !1 && (r = this[t]), s ?? (s = n.getPropertyOptions(t)), !((s.hasChanged ?? dt)(r, e) || s.useDefault && s.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(n._$Eu(t, s)))) return;
      this.C(t, e, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: s, reflect: i, wrapped: r }, n) {
    s && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, n ?? e ?? this[t]), r !== !0 || n !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (e = void 0), this._$AL.set(t, e)), i === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [i, r] of this._$Ep) this[i] = r;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [i, r] of s) {
        const { wrapped: n } = r, h = this[i];
        n !== !0 || this._$AL.has(i) || h === void 0 || this.C(i, void 0, r, h);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), this._$EO?.forEach((s) => s.hostUpdate?.()), this.update(e)) : this._$EM();
    } catch (s) {
      throw t = !1, this._$EM(), s;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
w.elementStyles = [], w.shadowRootOptions = { mode: "open" }, w[P("elementProperties")] = /* @__PURE__ */ new Map(), w[P("finalized")] = /* @__PURE__ */ new Map(), wt?.({ ReactiveElement: w }), (b.reactiveElementVersions ?? (b.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const k = globalThis, Y = (a) => a, D = k.trustedTypes, Q = D ? D.createPolicy("lit-html", { createHTML: (a) => a }) : void 0, ct = "$lit$", m = `lit$${Math.random().toFixed(9).slice(2)}$`, ht = "?" + m, At = `<${ht}>`, x = document, U = () => x.createComment(""), M = (a) => a === null || typeof a != "object" && typeof a != "function", W = Array.isArray, Ct = (a) => W(a) || typeof a?.[Symbol.iterator] == "function", L = `[ 	
\f\r]`, E = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, tt = /-->/g, et = />/g, y = RegExp(`>|${L}(?:([^\\s"'>=/]+)(${L}*=${L}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), st = /'/g, it = /"/g, pt = /^(?:script|style|textarea|title)$/i, St = (a) => (t, ...e) => ({ _$litType$: a, strings: t, values: e }), l = St(1), C = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), at = /* @__PURE__ */ new WeakMap(), $ = x.createTreeWalker(x, 129);
function ut(a, t) {
  if (!W(a) || !a.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Q !== void 0 ? Q.createHTML(t) : t;
}
const Et = (a, t) => {
  const e = a.length - 1, s = [];
  let i, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", n = E;
  for (let h = 0; h < e; h++) {
    const o = a[h];
    let p, u, c = -1, g = 0;
    for (; g < o.length && (n.lastIndex = g, u = n.exec(o), u !== null); ) g = n.lastIndex, n === E ? u[1] === "!--" ? n = tt : u[1] !== void 0 ? n = et : u[2] !== void 0 ? (pt.test(u[2]) && (i = RegExp("</" + u[2], "g")), n = y) : u[3] !== void 0 && (n = y) : n === y ? u[0] === ">" ? (n = i ?? E, c = -1) : u[1] === void 0 ? c = -2 : (c = n.lastIndex - u[2].length, p = u[1], n = u[3] === void 0 ? y : u[3] === '"' ? it : st) : n === it || n === st ? n = y : n === tt || n === et ? n = E : (n = y, i = void 0);
    const v = n === y && a[h + 1].startsWith("/>") ? " " : "";
    r += n === E ? o + At : c >= 0 ? (s.push(p), o.slice(0, c) + ct + o.slice(c) + m + v) : o + m + (c === -2 ? h : v);
  }
  return [ut(a, r + (a[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class R {
  constructor({ strings: t, _$litType$: e }, s) {
    let i;
    this.parts = [];
    let r = 0, n = 0;
    const h = t.length - 1, o = this.parts, [p, u] = Et(t, e);
    if (this.el = R.createElement(p, s), $.currentNode = this.el.content, e === 2 || e === 3) {
      const c = this.el.content.firstChild;
      c.replaceWith(...c.childNodes);
    }
    for (; (i = $.nextNode()) !== null && o.length < h; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const c of i.getAttributeNames()) if (c.endsWith(ct)) {
          const g = u[n++], v = i.getAttribute(c).split(m), H = /([.?@])?(.*)/.exec(g);
          o.push({ type: 1, index: r, name: H[2], strings: v, ctor: H[1] === "." ? kt : H[1] === "?" ? Tt : H[1] === "@" ? Ut : z }), i.removeAttribute(c);
        } else c.startsWith(m) && (o.push({ type: 6, index: r }), i.removeAttribute(c));
        if (pt.test(i.tagName)) {
          const c = i.textContent.split(m), g = c.length - 1;
          if (g > 0) {
            i.textContent = D ? D.emptyScript : "";
            for (let v = 0; v < g; v++) i.append(c[v], U()), $.nextNode(), o.push({ type: 2, index: ++r });
            i.append(c[g], U());
          }
        }
      } else if (i.nodeType === 8) if (i.data === ht) o.push({ type: 2, index: r });
      else {
        let c = -1;
        for (; (c = i.data.indexOf(m, c + 1)) !== -1; ) o.push({ type: 7, index: r }), c += m.length - 1;
      }
      r++;
    }
  }
  static createElement(t, e) {
    const s = x.createElement("template");
    return s.innerHTML = t, s;
  }
}
function S(a, t, e = a, s) {
  if (t === C) return t;
  let i = s !== void 0 ? e._$Co?.[s] : e._$Cl;
  const r = M(t) ? void 0 : t._$litDirective$;
  return i?.constructor !== r && (i?._$AO?.(!1), r === void 0 ? i = void 0 : (i = new r(a), i._$AT(a, e, s)), s !== void 0 ? (e._$Co ?? (e._$Co = []))[s] = i : e._$Cl = i), i !== void 0 && (t = S(a, i._$AS(a, t.values), i, s)), t;
}
class Pt {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: s } = this._$AD, i = (t?.creationScope ?? x).importNode(e, !0);
    $.currentNode = i;
    let r = $.nextNode(), n = 0, h = 0, o = s[0];
    for (; o !== void 0; ) {
      if (n === o.index) {
        let p;
        o.type === 2 ? p = new O(r, r.nextSibling, this, t) : o.type === 1 ? p = new o.ctor(r, o.name, o.strings, this, t) : o.type === 6 && (p = new Mt(r, this, t)), this._$AV.push(p), o = s[++h];
      }
      n !== o?.index && (r = $.nextNode(), n++);
    }
    return $.currentNode = x, i;
  }
  p(t) {
    let e = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, e), e += s.strings.length - 2) : s._$AI(t[e])), e++;
  }
}
class O {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, s, i) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = s, this.options = i, this._$Cv = i?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && t?.nodeType === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = S(this, t, e), M(t) ? t === d || t == null || t === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : t !== this._$AH && t !== C && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Ct(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== d && M(this._$AH) ? this._$AA.nextSibling.data = t : this.T(x.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: s } = t, i = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = R.createElement(ut(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === i) this._$AH.p(e);
    else {
      const r = new Pt(i, this), n = r.u(this.options);
      r.p(e), this.T(n), this._$AH = r;
    }
  }
  _$AC(t) {
    let e = at.get(t.strings);
    return e === void 0 && at.set(t.strings, e = new R(t)), e;
  }
  k(t) {
    W(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let s, i = 0;
    for (const r of t) i === e.length ? e.push(s = new O(this.O(U()), this.O(U()), this, this.options)) : s = e[i], s._$AI(r), i++;
    i < e.length && (this._$AR(s && s._$AB.nextSibling, i), e.length = i);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const s = Y(t).nextSibling;
      Y(t).remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class z {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, s, i, r) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = t, this.name = e, this._$AM = i, this.options = r, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = d;
  }
  _$AI(t, e = this, s, i) {
    const r = this.strings;
    let n = !1;
    if (r === void 0) t = S(this, t, e, 0), n = !M(t) || t !== this._$AH && t !== C, n && (this._$AH = t);
    else {
      const h = t;
      let o, p;
      for (t = r[0], o = 0; o < r.length - 1; o++) p = S(this, h[s + o], e, o), p === C && (p = this._$AH[o]), n || (n = !M(p) || p !== this._$AH[o]), p === d ? t = d : t !== d && (t += (p ?? "") + r[o + 1]), this._$AH[o] = p;
    }
    n && !i && this.j(t);
  }
  j(t) {
    t === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class kt extends z {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === d ? void 0 : t;
  }
}
class Tt extends z {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== d);
  }
}
class Ut extends z {
  constructor(t, e, s, i, r) {
    super(t, e, s, i, r), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = S(this, t, e, 0) ?? d) === C) return;
    const s = this._$AH, i = t === d && s !== d || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, r = t !== d && (s === d || i);
    i && this.element.removeEventListener(this.name, this, s), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Mt {
  constructor(t, e, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    S(this, t);
  }
}
const Rt = k.litHtmlPolyfillSupport;
Rt?.(R, O), (k.litHtmlVersions ?? (k.litHtmlVersions = [])).push("3.3.2");
const Ot = (a, t, e) => {
  const s = e?.renderBefore ?? t;
  let i = s._$litPart$;
  if (i === void 0) {
    const r = e?.renderBefore ?? null;
    s._$litPart$ = i = new O(t.insertBefore(U(), r), r, void 0, e ?? {});
  }
  return i._$AI(a), i;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const T = globalThis;
class A extends w {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var e;
    const t = super.createRenderRoot();
    return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Ot(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return C;
  }
}
A._$litElement$ = !0, A.finalized = !0, T.litElementHydrateSupport?.({ LitElement: A });
const Ht = T.litElementPolyfillSupport;
Ht?.({ LitElement: A });
(T.litElementVersions ?? (T.litElementVersions = [])).push("4.2.2");
const Nt = lt`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --card-secondary: var(--secondary-text-color, #727272);
    --accent: var(--primary-color, #7c3aed);
    --accent-text: var(--text-primary-color, #fff);
    --divider: var(--divider-color, rgba(0, 0, 0, 0.12));
    --user-bubble: var(--primary-color, #7c3aed);
    --user-text: var(--text-primary-color, #fff);
    --assistant-bubble: var(--secondary-background-color, #f5f5f5);
    --assistant-text: var(--primary-text-color, #212121);
    --input-bg: var(--card-background-color, #fff);
    --input-border: var(--divider-color, rgba(0, 0, 0, 0.12));
    --shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
  }

  .card-container {
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider);
    background: var(--card-bg);
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-text);
    font-size: 18px;
    font-weight: 600;
    flex-shrink: 0;
    overflow: hidden;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .header-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--card-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-status {
    font-size: 12px;
    color: var(--card-secondary);
  }

  /* Messages area */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
  }

  .messages::-webkit-scrollbar {
    width: 4px;
  }

  .messages::-webkit-scrollbar-thumb {
    background: var(--divider);
    border-radius: 2px;
  }

  .message {
    display: flex;
    flex-direction: column;
    max-width: 85%;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message.user {
    align-self: flex-end;
  }

  .message.assistant {
    align-self: flex-start;
  }

  .bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message.user .bubble {
    background: var(--user-bubble);
    color: var(--user-text);
    border-bottom-right-radius: 4px;
  }

  .message.assistant .bubble {
    background: var(--assistant-bubble);
    color: var(--assistant-text);
    border-bottom-left-radius: 4px;
  }

  .meta {
    font-size: 11px;
    color: var(--card-secondary);
    margin-top: 2px;
    padding: 0 4px;
  }

  .message.user .meta {
    text-align: right;
  }

  /* Typing indicator */
  .typing {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    align-self: flex-start;
  }

  .typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--card-secondary);
    animation: bounce 1.4s infinite ease-in-out;
  }

  .typing-dot:nth-child(1) { animation-delay: -0.32s; }
  .typing-dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Input bar */
  .input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--divider);
    background: var(--input-bg);
  }

  .input-bar input {
    flex: 1;
    border: 1px solid var(--input-border);
    border-radius: 20px;
    padding: 8px 14px;
    font-size: 14px;
    background: transparent;
    color: var(--card-text);
    outline: none;
    transition: border-color 0.2s;
  }

  .input-bar input:focus {
    border-color: var(--accent);
  }

  .input-bar input::placeholder {
    color: var(--card-secondary);
  }

  .btn-icon {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, opacity 0.2s;
    flex-shrink: 0;
    padding: 0;
  }

  .btn-send {
    background: var(--accent);
    color: var(--accent-text);
  }

  .btn-send:hover {
    opacity: 0.85;
  }

  .btn-send:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-mic {
    background: transparent;
    color: var(--card-secondary);
  }

  .btn-mic:hover {
    background: var(--divider);
  }

  .btn-mic.recording {
    color: #ef4444;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    color: var(--card-secondary);
    padding: 24px;
    text-align: center;
  }

  .empty-state .icon {
    font-size: 32px;
    opacity: 0.5;
  }

  /* Not configured state */
  .not-configured {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: var(--card-secondary);
    font-size: 14px;
    text-align: center;
  }
`, Dt = lt`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --card-secondary: var(--secondary-text-color, #727272);
    --accent: var(--primary-color, #7c3aed);
    --divider: var(--divider-color, rgba(0, 0, 0, 0.12));
  }

  .editor {
    padding: 16px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--divider);
    margin-bottom: 16px;
    overflow-x: auto;
  }

  .tab {
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--card-secondary);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab:hover {
    color: var(--card-text);
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 12px;
    font-weight: 500;
    color: var(--card-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field input,
  .field select,
  .field textarea {
    border: 1px solid var(--divider);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    background: transparent;
    color: var(--card-text);
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--accent);
  }

  .field textarea {
    min-height: 80px;
    resize: vertical;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .toggle-row label {
    font-size: 14px;
    color: var(--card-text);
    text-transform: none;
    letter-spacing: 0;
  }

  .toggle-row .sublabel {
    font-size: 12px;
    color: var(--card-secondary);
  }

  /* Simple toggle switch */
  .switch {
    position: relative;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    background: var(--divider);
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .slider::before {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    left: 2px;
    bottom: 2px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .switch input:checked + .slider {
    background: var(--accent);
  }

  .switch input:checked + .slider::before {
    transform: translateX(18px);
  }

  /* Avatar preview */
  .avatar-preview {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--divider);
  }

  .avatar-upload {
    display: flex;
    align-items: center;
    gap: 12px;
  }
`, rt = {
  card_id: "",
  agent_id: "conversation",
  prompt_override: "",
  avatar: "",
  tts_voice: "",
  stt_enabled: !1,
  personality_enabled: !1,
  personality: {
    name: "",
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: [],
    creator_notes: ""
  },
  per_card_memory: !1,
  allowed_users: [],
  show_metadata: !0,
  card_height: 500
};
async function zt(a) {
  try {
    const t = await a.arrayBuffer(), e = new Uint8Array(t), s = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let r = 0; r < 8; r++)
      if (e[r] !== s[r]) return null;
    let i = 8;
    for (; i < e.length - 12; ) {
      const r = It(e, i), n = B(e, i + 4, 4);
      if (n === "tEXt" || n === "iTXt") {
        const h = e.slice(i + 8, i + 8 + r), o = Lt(h, n);
        if (o) return o;
      }
      i += 12 + r;
    }
    return null;
  } catch {
    return null;
  }
}
function Lt(a, t) {
  if (t === "tEXt") {
    const e = a.indexOf(0);
    if (e < 0) return null;
    const s = B(a, 0, e).toLowerCase();
    if (s !== "ccv3" && s !== "chara") return null;
    const i = a.slice(e + 1), r = new TextDecoder().decode(i);
    return nt(r);
  }
  if (t === "iTXt") {
    const e = a.indexOf(0);
    if (e < 0) return null;
    const s = B(a, 0, e).toLowerCase();
    if (s !== "ccv3" && s !== "chara") return null;
    let i = e + 3;
    for (; i < a.length && a[i] !== 0; ) i++;
    for (i++; i < a.length && a[i] !== 0; ) i++;
    i++;
    const r = new TextDecoder().decode(a.slice(i));
    return nt(r);
  }
  return null;
}
function nt(a, t) {
  try {
    let e;
    try {
      e = atob(a.trim());
    } catch {
      e = a;
    }
    const s = JSON.parse(e);
    return s.spec === "chara_card_v3" && s.data || s.spec === "chara_card_v2" && s.data ? I(s.data) : s.name || s.description || s.personality ? I(s) : null;
  } catch {
    return null;
  }
}
function I(a) {
  return {
    name: String(a.name || ""),
    description: String(a.description || ""),
    personality: String(a.personality || ""),
    scenario: String(a.scenario || ""),
    first_mes: String(a.first_mes || ""),
    mes_example: String(a.mes_example || ""),
    system_prompt: String(a.system_prompt || ""),
    post_history_instructions: String(a.post_history_instructions || ""),
    alternate_greetings: Array.isArray(a.alternate_greetings) ? a.alternate_greetings.map(String) : [],
    tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
    creator_notes: String(a.creator_notes || "")
  };
}
function It(a, t) {
  return (a[t] << 24 | a[t + 1] << 16 | a[t + 2] << 8 | a[t + 3]) >>> 0;
}
function B(a, t, e) {
  return String.fromCharCode(...a.slice(t, t + e));
}
var Ft = Object.defineProperty, Bt = (a, t, e) => t in a ? Ft(a, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : a[t] = e, f = (a, t, e) => Bt(a, typeof t != "symbol" ? t + "" : t, e);
class q extends A {
  constructor() {
    super(...arguments), f(this, "hass"), f(this, "_config"), f(this, "_cardConfig", { ...rt }), f(this, "_tab", "basic"), f(this, "_agents", []), f(this, "_voices", []), f(this, "_loaded", !1);
  }
  setConfig(t) {
    this._config = t, this._loaded = !1;
  }
  async willUpdate() {
    this.hass && this._config?.card_id && !this._loaded && (this._loaded = !0, await this._loadData());
  }
  async _loadData() {
    try {
      const [t, e, s] = await Promise.all([
        this.hass.callWS({
          type: "proxlab/card/config/get",
          card_id: this._config.card_id
        }),
        this.hass.callWS({ type: "proxlab/agent/available" }),
        this.hass.callWS({ type: "proxlab/card/voices" })
      ]);
      t ? this._cardConfig = t : this._cardConfig = { ...rt, card_id: this._config.card_id }, this._agents = e || [], this._voices = s || [];
    } catch {
    }
  }
  render() {
    return l`
      <div class="editor">
        <div class="tabs">
          ${["basic", "personality", "appearance", "voice", "advanced"].map(
      (t) => l`
              <button
                class="tab ${this._tab === t ? "active" : ""}"
                @click=${() => {
        this._tab = t;
      }}
              >
                ${t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            `
    )}
        </div>
        <div class="tab-content">
          ${this._tab === "basic" ? this._renderBasicTab() : d}
          ${this._tab === "personality" ? this._renderPersonalityTab() : d}
          ${this._tab === "appearance" ? this._renderAppearanceTab() : d}
          ${this._tab === "voice" ? this._renderVoiceTab() : d}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : d}
        </div>
      </div>
    `;
  }
  // ---- Tabs ----
  _renderBasicTab() {
    return l`
      <div class="field">
        <label>Agent</label>
        <select
          .value=${this._cardConfig.agent_id}
          @change=${(t) => this._updateField("agent_id", t.target.value)}
        >
          <option value="conversation">Default (Orchestrator)</option>
          ${this._agents.map(
      (t) => l`<option value=${t.agent_id} ?selected=${this._cardConfig.agent_id === t.agent_id}>
              ${t.name}
            </option>`
    )}
        </select>
      </div>
      <div class="field">
        <label>Custom Prompt</label>
        <textarea
          placeholder="Override the agent's default prompt..."
          .value=${this._cardConfig.prompt_override}
          @input=${(t) => this._updateField("prompt_override", t.target.value)}
        ></textarea>
      </div>
      <div class="field">
        <label>Card Height (px)</label>
        <input
          type="number"
          min="200"
          max="1200"
          .value=${String(this._cardConfig.card_height)}
          @input=${(t) => this._updateField("card_height", parseInt(t.target.value) || 500)}
        />
      </div>
    `;
  }
  _renderPersonalityTab() {
    const t = this._cardConfig.personality;
    return l`
      <div class="toggle-row">
        <div>
          <label>Enable Personality</label>
          <div class="sublabel">Use Character Card V3 personality fields</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.personality_enabled}
            @change=${(e) => this._updateField("personality_enabled", e.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>

      ${this._cardConfig.personality_enabled ? l`
            <div class="field">
              <label>Import Character Card PNG</label>
              <input type="file" accept=".png" @change=${this._onPngUpload} />
            </div>
            <div class="field">
              <label>Character Name</label>
              <input
                type="text"
                .value=${t.name}
                @input=${(e) => this._updatePersonality("name", e.target.value)}
              />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea
                .value=${t.description}
                @input=${(e) => this._updatePersonality("description", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Personality</label>
              <textarea
                .value=${t.personality}
                @input=${(e) => this._updatePersonality("personality", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Scenario</label>
              <textarea
                .value=${t.scenario}
                @input=${(e) => this._updatePersonality("scenario", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>System Prompt</label>
              <textarea
                .value=${t.system_prompt}
                @input=${(e) => this._updatePersonality("system_prompt", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>First Message</label>
              <textarea
                .value=${t.first_mes}
                @input=${(e) => this._updatePersonality("first_mes", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Example Dialogue</label>
              <textarea
                .value=${t.mes_example}
                @input=${(e) => this._updatePersonality("mes_example", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Post-History Instructions</label>
              <textarea
                .value=${t.post_history_instructions}
                @input=${(e) => this._updatePersonality("post_history_instructions", e.target.value)}
              ></textarea>
            </div>
          ` : d}
    `;
  }
  _renderAppearanceTab() {
    return l`
      <div class="field">
        <label>Avatar</label>
        <div class="avatar-upload">
          ${this._cardConfig.avatar ? l`<img class="avatar-preview" src="${this._cardConfig.avatar}" />` : l`<div class="avatar-preview" style="display:flex;align-items:center;justify-content:center;background:var(--divider)">?</div>`}
          <input type="file" accept="image/*" @change=${this._onAvatarUpload} />
        </div>
      </div>
      <div class="toggle-row">
        <div>
          <label>Show Metadata</label>
          <div class="sublabel">Display model, tokens, and timing on messages</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.show_metadata}
            @change=${(t) => this._updateField("show_metadata", t.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }
  _renderVoiceTab() {
    return l`
      <div class="field">
        <label>TTS Voice</label>
        <select
          .value=${this._cardConfig.tts_voice}
          @change=${(t) => this._updateField("tts_voice", t.target.value)}
        >
          <option value="">Disabled</option>
          ${this._voices.map(
      (t) => l`<option value=${t.id} ?selected=${this._cardConfig.tts_voice === t.id}>
              ${t.name}
            </option>`
    )}
        </select>
      </div>
      <div class="toggle-row">
        <div>
          <label>Speech-to-Text</label>
          <div class="sublabel">Enable microphone input for voice messages</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.stt_enabled}
            @change=${(t) => this._updateField("stt_enabled", t.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }
  _renderAdvancedTab() {
    return l`
      <div class="toggle-row">
        <div>
          <label>Per-Card Memory</label>
          <div class="sublabel">Create a separate Milvus collection for this card's conversations</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.per_card_memory}
            @change=${(t) => this._updateField("per_card_memory", t.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
      <div class="field">
        <label>Card ID</label>
        <input type="text" .value=${this._cardConfig.card_id} disabled />
      </div>
    `;
  }
  // ---- Actions ----
  _updateField(t, e) {
    this._cardConfig = { ...this._cardConfig, [t]: e }, this._saveAndFireEvent();
  }
  _updatePersonality(t, e) {
    this._cardConfig = {
      ...this._cardConfig,
      personality: { ...this._cardConfig.personality, [t]: e }
    }, this._saveAndFireEvent();
  }
  async _saveAndFireEvent() {
    if (this.hass && this._config?.card_id)
      try {
        await this.hass.callWS({
          type: "proxlab/card/config/save",
          card_id: this._config.card_id,
          config: this._cardConfig
        });
      } catch {
      }
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: !0,
        composed: !0
      })
    );
  }
  async _onAvatarUpload(t) {
    const e = t.target.files?.[0];
    if (!e || !this.hass || !this._config?.card_id) return;
    const s = new FileReader();
    s.onloadend = async () => {
      const i = s.result.split(",")[1];
      try {
        const r = await this.hass.callWS({
          type: "proxlab/card/avatar/upload",
          card_id: this._config.card_id,
          data: i,
          filename: e.name
        });
        this._updateField("avatar", r.url);
      } catch {
      }
    }, s.readAsDataURL(e);
  }
  async _onPngUpload(t) {
    const e = t.target.files?.[0];
    if (!e) return;
    const s = await zt(e);
    if (s && (this._cardConfig = {
      ...this._cardConfig,
      personality: s,
      personality_enabled: !0
    }, this._saveAndFireEvent()), this.hass && this._config?.card_id) {
      const i = new FileReader();
      i.onloadend = async () => {
        const r = i.result.split(",")[1];
        try {
          const n = await this.hass.callWS({
            type: "proxlab/card/avatar/upload",
            card_id: this._config.card_id,
            data: r,
            filename: e.name
          });
          this._updateField("avatar", n.url);
        } catch {
        }
      }, i.readAsDataURL(e);
    }
  }
}
f(q, "styles", Dt);
f(q, "properties", {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _tab: { state: !0 },
  _agents: { state: !0 },
  _voices: { state: !0 },
  _loaded: { state: !0 }
});
customElements.define("proxlab-chat-card-editor", q);
var Vt = Object.defineProperty, jt = (a, t, e) => t in a ? Vt(a, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : a[t] = e, _ = (a, t, e) => jt(a, typeof t != "symbol" ? t + "" : t, e);
const Wt = l`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, qt = l`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`, Gt = l`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
class G extends A {
  constructor() {
    super(...arguments), _(this, "hass"), _(this, "_config"), _(this, "_cardConfig"), _(this, "_messages", []), _(this, "_loading", !1), _(this, "_inputValue", ""), _(this, "_recording", !1), _(this, "_configLoaded", !1), _(this, "_mediaRecorder"), _(this, "_audioChunks", []);
  }
  // ---- Lovelace lifecycle ----
  setConfig(t) {
    if (!t.card_id)
      throw new Error("Please set a card_id in the card configuration");
    this._config = t, this._configLoaded = !1;
  }
  static getConfigElement() {
    return document.createElement("proxlab-chat-card-editor");
  }
  static getStubConfig() {
    return {
      type: "custom:proxlab-chat-card",
      card_id: crypto.randomUUID().slice(0, 8)
    };
  }
  getCardSize() {
    return Math.max(3, Math.ceil((this._cardConfig?.card_height ?? 500) / 50));
  }
  // ---- Reactive updates ----
  willUpdate(t) {
    t.has("hass") && this._config && !this._configLoaded && this._loadCardConfig();
  }
  async _loadCardConfig() {
    if (!(!this.hass || !this._config?.card_id)) {
      this._configLoaded = !0;
      try {
        const t = await this.hass.callWS({
          type: "proxlab/card/config/get",
          card_id: this._config.card_id
        });
        this._cardConfig = t ?? void 0, this._messages.length === 0 && t?.personality_enabled && t?.personality?.first_mes && (this._messages = [
          {
            role: "assistant",
            content: t.personality.first_mes,
            timestamp: Date.now()
          }
        ]);
      } catch {
      }
    }
  }
  // ---- Rendering ----
  render() {
    if (!this._config)
      return l`<ha-card><div class="not-configured">No configuration</div></ha-card>`;
    if (this._cardConfig?.allowed_users?.length) {
      const i = this.hass?.user?.id;
      if (i && !this._cardConfig.allowed_users.includes(i))
        return l``;
    }
    const t = this._cardConfig?.card_height ?? 500, e = this._cardConfig?.personality_enabled && this._cardConfig?.personality?.name ? this._cardConfig.personality.name : "ProxLab Chat", s = this._cardConfig?.avatar;
    return l`
      <ha-card>
        <div class="card-container" style="height: ${t}px">
          ${this._renderHeader(e, s)}
          ${this._renderMessages()}
          ${this._renderInputBar()}
        </div>
      </ha-card>
    `;
  }
  _renderHeader(t, e) {
    return l`
      <div class="card-header">
        <div class="avatar">
          ${e ? l`<img src="${e}" alt="${t}" />` : t.charAt(0).toUpperCase()}
        </div>
        <div class="header-info">
          <div class="header-name">${t}</div>
          <div class="header-status">
            ${this._loading ? "Thinking..." : "Online"}
          </div>
        </div>
      </div>
    `;
  }
  _renderMessages() {
    return this._messages.length === 0 && !this._loading ? l`
        <div class="messages" style="flex: 1">
          <div class="empty-state">
            ${Gt}
            <span>Start a conversation</span>
          </div>
        </div>
      ` : l`
      <div class="messages">
        ${this._messages.map(
      (t) => l`
            <div class="message ${t.role}">
              <div class="bubble">${t.content}</div>
              ${this._cardConfig?.show_metadata !== !1 && t.metadata ? l`<div class="meta">
                    ${t.metadata.model ? t.metadata.model : ""}
                    ${t.metadata.tokens ? ` | ${t.metadata.tokens} tokens` : ""}
                    ${t.metadata.duration_ms ? ` | ${(t.metadata.duration_ms / 1e3).toFixed(1)}s` : ""}
                  </div>` : d}
            </div>
          `
    )}
        ${this._loading ? l`<div class="typing">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>` : d}
      </div>
    `;
  }
  _renderInputBar() {
    return l`
      <div class="input-bar">
        ${this._cardConfig?.stt_enabled ? l`<button
              class="btn-icon btn-mic ${this._recording ? "recording" : ""}"
              @click=${this._toggleRecording}
              title="Voice input"
            >
              ${qt}
            </button>` : d}
        <input
          type="text"
          placeholder="Type a message..."
          .value=${this._inputValue}
          @input=${(t) => {
      this._inputValue = t.target.value;
    }}
          @keydown=${(t) => {
      t.key === "Enter" && !t.shiftKey && (t.preventDefault(), this._sendMessage());
    }}
          ?disabled=${this._loading}
        />
        <button
          class="btn-icon btn-send"
          @click=${this._sendMessage}
          ?disabled=${this._loading || !this._inputValue.trim()}
          title="Send"
        >
          ${Wt}
        </button>
      </div>
    `;
  }
  // ---- Actions ----
  async _sendMessage() {
    const t = this._inputValue.trim();
    if (!(!t || this._loading || !this.hass || !this._config?.card_id)) {
      this._messages = [
        ...this._messages,
        { role: "user", content: t, timestamp: Date.now() }
      ], this._inputValue = "", this._loading = !0, this._scrollToBottom();
      try {
        const e = await this.hass.callWS({
          type: "proxlab/card/invoke",
          card_id: this._config.card_id,
          message: t,
          conversation_id: `card_${this._config.card_id}`
        });
        this._messages = [
          ...this._messages,
          {
            role: "assistant",
            content: e.response_text || "No response",
            timestamp: Date.now(),
            metadata: {
              agent_name: e.agent_name,
              tokens: e.tokens,
              duration_ms: e.duration_ms,
              model: e.model,
              tool_results: e.tool_results
            }
          }
        ], e.tts_audio_url && this._cardConfig?.tts_voice && this._playAudio(e.tts_audio_url);
      } catch (e) {
        const s = e instanceof Error ? e.message : String(e);
        this._messages = [
          ...this._messages,
          {
            role: "assistant",
            content: `Error: ${s}`,
            timestamp: Date.now()
          }
        ];
      } finally {
        this._loading = !1, this._scrollToBottom();
      }
    }
  }
  _scrollToBottom() {
    requestAnimationFrame(() => {
      const t = this.renderRoot?.querySelector(".messages");
      t && (t.scrollTop = t.scrollHeight);
    });
  }
  _playAudio(t) {
    try {
      new Audio(t).play().catch(() => {
      });
    } catch {
    }
  }
  // ---- STT (Mic) ----
  async _toggleRecording() {
    if (this._recording) {
      this._mediaRecorder?.stop(), this._recording = !1;
      return;
    }
    try {
      const t = await navigator.mediaDevices.getUserMedia({ audio: !0 });
      this._audioChunks = [], this._mediaRecorder = new MediaRecorder(t), this._mediaRecorder.ondataavailable = (e) => {
        e.data.size > 0 && this._audioChunks.push(e.data);
      }, this._mediaRecorder.onstop = async () => {
        t.getTracks().forEach((s) => s.stop());
        const e = new Blob(this._audioChunks, { type: "audio/webm" });
        await this._transcribeAudio(e);
      }, this._mediaRecorder.start(), this._recording = !0;
    } catch {
    }
  }
  async _transcribeAudio(t) {
    try {
      const e = new FileReader(), s = await new Promise((i) => {
        e.onloadend = () => {
          const r = e.result;
          i(r.split(",")[1] || "");
        }, e.readAsDataURL(t);
      });
      if (this.hass.config.components.includes("stt")) {
        const i = await this.hass.callWS({
          type: "stt/stream",
          audio_data: s,
          language: this.hass.language || "en"
        });
        i?.text && (this._inputValue = i.text);
      }
    } catch {
    }
  }
}
_(G, "styles", Nt);
_(G, "properties", {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _messages: { state: !0 },
  _loading: { state: !0 },
  _inputValue: { state: !0 },
  _recording: { state: !0 },
  _configLoaded: { state: !0 }
});
customElements.define("proxlab-chat-card", G);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxlab-chat-card",
  name: "ProxLab Chat",
  description: "Chat with ProxLab agents directly from your dashboard",
  preview: !0,
  documentationURL: "https://github.com/travisfinch1983/ha-proxlab"
});
export {
  G as ProxLabChatCard
};

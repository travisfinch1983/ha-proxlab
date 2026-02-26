var ProxLabChatCard=(function(n){"use strict";var fe=Object.create;var gt=Object.defineProperty;var ge=Object.getOwnPropertyDescriptor;var qt=(n,l)=>(l=Symbol[n])?l:Symbol.for("Symbol."+n),rt=n=>{throw TypeError(n)};var Ft=(n,l,h)=>l in n?gt(n,l,{enumerable:!0,configurable:!0,writable:!0,value:h}):n[l]=h;var Vt=(n,l)=>gt(n,"name",{value:l,configurable:!0});var Kt=n=>[,,,fe((n==null?void 0:n[qt("metadata")])??null)],Zt=["class","method","getter","setter","accessor","field","value","get","set"],it=n=>n!==void 0&&typeof n!="function"?rt("Function expected"):n,_e=(n,l,h,x,_)=>({kind:Zt[n],name:l,metadata:x,addInitializer:y=>h._?rt("Already initialized"):_.push(it(y||null))}),me=(n,l)=>Ft(l,qt("metadata"),n[3]),v=(n,l,h,x)=>{for(var _=0,y=n[l>>1],O=y&&y.length;_<O;_++)l&1?y[_].call(h):x=y[_].call(h,x);return x},R=(n,l,h,x,_,y)=>{var O,w,ot,T,K,u=l&7,Z=!!(l&8),k=!!(l&16),J=u>3?n.length+1:u?Z?1:2:0,at=Zt[u+5],P=u>3&&(n[J-1]=[]),nt=n[J]||(n[J]=[]),S=u&&(!k&&!Z&&(_=_.prototype),u<5&&(u>3||!k)&&ge(u<4?_:{get[h](){return Lt(this,y)},set[h]($){return Wt(this,y,$)}},h));u?k&&u<4&&Vt(y,(u>2?"set ":u>1?"get ":"")+h):Vt(_,h);for(var N=x.length-1;N>=0;N--)T=_e(u,h,ot={},n[3],nt),u&&(T.static=Z,T.private=k,K=T.access={has:k?$=>ve(_,$):$=>h in $},u^3&&(K.get=k?$=>(u^1?Lt:$e)($,_,u^4?y:S.get):$=>$[h]),u>2&&(K.set=k?($,H)=>Wt($,_,H,u^4?y:S.set):($,H)=>$[h]=H)),w=(0,x[N])(u?u<4?k?y:S[at]:u>4?void 0:{get:S.get,set:S.set}:_,T),ot._=1,u^4||w===void 0?it(w)&&(u>4?P.unshift(w):u?k?y=w:S[at]=w:_=w):typeof w!="object"||w===null?rt("Object expected"):(it(O=w.get)&&(S.get=O),it(O=w.set)&&(S.set=O),it(O=w.init)&&P.unshift(O));return u||me(n,_),S&&gt(_,h,S),k?u^4?y:S:_},C=(n,l,h)=>Ft(n,typeof l!="symbol"?l+"":l,h),_t=(n,l,h)=>l.has(n)||rt("Cannot "+h),ve=(n,l)=>Object(l)!==l?rt('Cannot use the "in" operator on this value'):n.has(l),Lt=(n,l,h)=>(_t(n,l,"read from private field"),h?h.call(n):l.get(n));var Wt=(n,l,h,x)=>(_t(n,l,"write to private field"),x?x.call(n,h):l.set(n,h),h),$e=(n,l,h)=>(_t(n,l,"access private method"),h);/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */var Pt,Ut,Rt,Ot,Tt,Ht,zt,Nt,jt,Dt,It,Bt,p;const l=globalThis,h=l.ShadowRoot&&(l.ShadyCSS===void 0||l.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,x=Symbol(),_=new WeakMap;let y=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==x)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(h&&t===void 0){const s=e!==void 0&&e.length===1;s&&(t=_.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&_.set(e,t))}return t}toString(){return this.cssText}};const O=o=>new y(typeof o=="string"?o:o+"",void 0,x),w=(o,...t)=>{const e=o.length===1?o[0]:t.reduce((s,i,r)=>s+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+o[r+1],o[0]);return new y(e,o,x)},ot=(o,t)=>{if(h)o.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const s=document.createElement("style"),i=l.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=e.cssText,o.appendChild(s)}},T=h?o=>o:o=>o instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return O(e)})(o):o;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:K,defineProperty:u,getOwnPropertyDescriptor:Z,getOwnPropertyNames:k,getOwnPropertySymbols:J,getPrototypeOf:at}=Object,P=globalThis,nt=P.trustedTypes,S=nt?nt.emptyScript:"",N=P.reactiveElementPolyfillSupport,$=(o,t)=>o,H={toAttribute(o,t){switch(t){case Boolean:o=o?S:null;break;case Object:case Array:o=o==null?o:JSON.stringify(o)}return o},fromAttribute(o,t){let e=o;switch(t){case Boolean:e=o!==null;break;case Number:e=o===null?null:Number(o);break;case Object:case Array:try{e=JSON.parse(o)}catch{e=null}}return e}},lt=(o,t)=>!K(o,t),mt={attribute:!0,type:String,converter:H,reflect:!1,useDefault:!1,hasChanged:lt};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),P.litPropertyMetadata??(P.litPropertyMetadata=new WeakMap);let W=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=mt){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);i!==void 0&&u(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:r}=Z(this.prototype,t)??{get(){return this[e]},set(a){this[e]=a}};return{get:i,set(a){const d=i==null?void 0:i.call(this);r==null||r.call(this,a),this.requestUpdate(t,d,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??mt}static _$Ei(){if(this.hasOwnProperty($("elementProperties")))return;const t=at(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty($("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty($("properties"))){const e=this.properties,s=[...k(e),...J(e)];for(const i of s)this.createProperty(i,e[i])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[s,i]of e)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[e,s]of this.elementProperties){const i=this._$Eu(e,s);i!==void 0&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)e.unshift(T(i))}else t!==void 0&&e.push(T(t));return e}static _$Eu(t,e){const s=e.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return ot(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var s;return(s=e.hostConnected)==null?void 0:s.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var s;return(s=e.hostDisconnected)==null?void 0:s.call(e)})}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){var r;const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const a=(((r=s.converter)==null?void 0:r.toAttribute)!==void 0?s.converter:H).toAttribute(e,s.type);this._$Em=t,a==null?this.removeAttribute(i):this.setAttribute(i,a),this._$Em=null}}_$AK(t,e){var r,a;const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const d=s.getPropertyOptions(i),c=typeof d.converter=="function"?{fromAttribute:d.converter}:((r=d.converter)==null?void 0:r.fromAttribute)!==void 0?d.converter:H;this._$Em=i;const g=c.fromAttribute(e,d.type);this[i]=g??((a=this._$Ej)==null?void 0:a.get(i))??g,this._$Em=null}}requestUpdate(t,e,s,i=!1,r){var a;if(t!==void 0){const d=this.constructor;if(i===!1&&(r=this[t]),s??(s=d.getPropertyOptions(t)),!((s.hasChanged??lt)(r,e)||s.useDefault&&s.reflect&&r===((a=this._$Ej)==null?void 0:a.get(t))&&!this.hasAttribute(d._$Eu(t,s))))return;this.C(t,e,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:r},a){s&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,a??e??this[t]),r!==!0||a!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),i===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var s;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[r,a]of this._$Ep)this[r]=a;this._$Ep=void 0}const i=this.constructor.elementProperties;if(i.size>0)for(const[r,a]of i){const{wrapped:d}=a,c=this[r];d!==!0||this._$AL.has(r)||c===void 0||this.C(r,void 0,a,c)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),(s=this._$EO)==null||s.forEach(i=>{var r;return(r=i.hostUpdate)==null?void 0:r.call(i)}),this.update(e)):this._$EM()}catch(i){throw t=!1,this._$EM(),i}t&&this._$AE(e)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(s=>{var i;return(i=s.hostUpdated)==null?void 0:i.call(s)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};W.elementStyles=[],W.shadowRootOptions={mode:"open"},W[$("elementProperties")]=new Map,W[$("finalized")]=new Map,N==null||N({ReactiveElement:W}),(P.reactiveElementVersions??(P.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Y=globalThis,vt=o=>o,ct=Y.trustedTypes,$t=ct?ct.createPolicy("lit-html",{createHTML:o=>o}):void 0,bt="$lit$",z=`lit$${Math.random().toFixed(9).slice(2)}$`,yt="?"+z,Jt=`<${yt}>`,j=document,X=()=>j.createComment(""),G=o=>o===null||typeof o!="object"&&typeof o!="function",ht=Array.isArray,Yt=o=>ht(o)||typeof(o==null?void 0:o[Symbol.iterator])=="function",pt=`[ 	
\f\r]`,Q=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,xt=/-->/g,wt=/>/g,D=RegExp(`>|${pt}(?:([^\\s"'>=/]+)(${pt}*=${pt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),At=/'/g,Et=/"/g,St=/^(?:script|style|textarea|title)$/i,Xt=o=>(t,...e)=>({_$litType$:o,strings:t,values:e}),A=Xt(1),q=Symbol.for("lit-noChange"),m=Symbol.for("lit-nothing"),Ct=new WeakMap,I=j.createTreeWalker(j,129);function kt(o,t){if(!ht(o)||!o.hasOwnProperty("raw"))throw Error("invalid template strings array");return $t!==void 0?$t.createHTML(t):t}const Gt=(o,t)=>{const e=o.length-1,s=[];let i,r=t===2?"<svg>":t===3?"<math>":"",a=Q;for(let d=0;d<e;d++){const c=o[d];let g,b,f=-1,M=0;for(;M<c.length&&(a.lastIndex=M,b=a.exec(c),b!==null);)M=a.lastIndex,a===Q?b[1]==="!--"?a=xt:b[1]!==void 0?a=wt:b[2]!==void 0?(St.test(b[2])&&(i=RegExp("</"+b[2],"g")),a=D):b[3]!==void 0&&(a=D):a===D?b[0]===">"?(a=i??Q,f=-1):b[1]===void 0?f=-2:(f=a.lastIndex-b[2].length,g=b[1],a=b[3]===void 0?D:b[3]==='"'?Et:At):a===Et||a===At?a=D:a===xt||a===wt?a=Q:(a=D,i=void 0);const U=a===D&&o[d+1].startsWith("/>")?" ":"";r+=a===Q?c+Jt:f>=0?(s.push(g),c.slice(0,f)+bt+c.slice(f)+z+U):c+z+(f===-2?d:U)}return[kt(o,r+(o[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class tt{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let r=0,a=0;const d=t.length-1,c=this.parts,[g,b]=Gt(t,e);if(this.el=tt.createElement(g,s),I.currentNode=this.el.content,e===2||e===3){const f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(i=I.nextNode())!==null&&c.length<d;){if(i.nodeType===1){if(i.hasAttributes())for(const f of i.getAttributeNames())if(f.endsWith(bt)){const M=b[a++],U=i.getAttribute(f).split(z),L=/([.?@])?(.*)/.exec(M);c.push({type:1,index:r,name:L[2],strings:U,ctor:L[1]==="."?te:L[1]==="?"?ee:L[1]==="@"?se:dt}),i.removeAttribute(f)}else f.startsWith(z)&&(c.push({type:6,index:r}),i.removeAttribute(f));if(St.test(i.tagName)){const f=i.textContent.split(z),M=f.length-1;if(M>0){i.textContent=ct?ct.emptyScript:"";for(let U=0;U<M;U++)i.append(f[U],X()),I.nextNode(),c.push({type:2,index:++r});i.append(f[M],X())}}}else if(i.nodeType===8)if(i.data===yt)c.push({type:2,index:r});else{let f=-1;for(;(f=i.data.indexOf(z,f+1))!==-1;)c.push({type:7,index:r}),f+=z.length-1}r++}}static createElement(t,e){const s=j.createElement("template");return s.innerHTML=t,s}}function F(o,t,e=o,s){var a,d;if(t===q)return t;let i=s!==void 0?(a=e._$Co)==null?void 0:a[s]:e._$Cl;const r=G(t)?void 0:t._$litDirective$;return(i==null?void 0:i.constructor)!==r&&((d=i==null?void 0:i._$AO)==null||d.call(i,!1),r===void 0?i=void 0:(i=new r(o),i._$AT(o,e,s)),s!==void 0?(e._$Co??(e._$Co=[]))[s]=i:e._$Cl=i),i!==void 0&&(t=F(o,i._$AS(o,t.values),i,s)),t}class Qt{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=((t==null?void 0:t.creationScope)??j).importNode(e,!0);I.currentNode=i;let r=I.nextNode(),a=0,d=0,c=s[0];for(;c!==void 0;){if(a===c.index){let g;c.type===2?g=new et(r,r.nextSibling,this,t):c.type===1?g=new c.ctor(r,c.name,c.strings,this,t):c.type===6&&(g=new ie(r,this,t)),this._$AV.push(g),c=s[++d]}a!==(c==null?void 0:c.index)&&(r=I.nextNode(),a++)}return I.currentNode=j,i}p(t){let e=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class et{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=m,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=(i==null?void 0:i.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=F(this,t,e),G(t)?t===m||t==null||t===""?(this._$AH!==m&&this._$AR(),this._$AH=m):t!==this._$AH&&t!==q&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Yt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==m&&G(this._$AH)?this._$AA.nextSibling.data=t:this.T(j.createTextNode(t)),this._$AH=t}$(t){var r;const{values:e,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=tt.createElement(kt(s.h,s.h[0]),this.options)),s);if(((r=this._$AH)==null?void 0:r._$AD)===i)this._$AH.p(e);else{const a=new Qt(i,this),d=a.u(this.options);a.p(e),this.T(d),this._$AH=a}}_$AC(t){let e=Ct.get(t.strings);return e===void 0&&Ct.set(t.strings,e=new tt(t)),e}k(t){ht(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const r of t)i===e.length?e.push(s=new et(this.O(X()),this.O(X()),this,this.options)):s=e[i],s._$AI(r),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){var s;for((s=this._$AP)==null?void 0:s.call(this,!1,!0,e);t!==this._$AB;){const i=vt(t).nextSibling;vt(t).remove(),t=i}}setConnected(t){var e;this._$AM===void 0&&(this._$Cv=t,(e=this._$AP)==null||e.call(this,t))}}class dt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,r){this.type=1,this._$AH=m,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=r,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=m}_$AI(t,e=this,s,i){const r=this.strings;let a=!1;if(r===void 0)t=F(this,t,e,0),a=!G(t)||t!==this._$AH&&t!==q,a&&(this._$AH=t);else{const d=t;let c,g;for(t=r[0],c=0;c<r.length-1;c++)g=F(this,d[s+c],e,c),g===q&&(g=this._$AH[c]),a||(a=!G(g)||g!==this._$AH[c]),g===m?t=m:t!==m&&(t+=(g??"")+r[c+1]),this._$AH[c]=g}a&&!i&&this.j(t)}j(t){t===m?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class te extends dt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===m?void 0:t}}class ee extends dt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==m)}}class se extends dt{constructor(t,e,s,i,r){super(t,e,s,i,r),this.type=5}_$AI(t,e=this){if((t=F(this,t,e,0)??m)===q)return;const s=this._$AH,i=t===m&&s!==m||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,r=t!==m&&(s===m||i);i&&this.element.removeEventListener(this.name,this,s),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}}class ie{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){F(this,t)}}const ut=Y.litHtmlPolyfillSupport;ut==null||ut(tt,et),(Y.litHtmlVersions??(Y.litHtmlVersions=[])).push("3.3.2");const re=(o,t,e)=>{const s=(e==null?void 0:e.renderBefore)??t;let i=s._$litPart$;if(i===void 0){const r=(e==null?void 0:e.renderBefore)??null;s._$litPart$=i=new et(t.insertBefore(X(),r),r,void 0,e??{})}return i._$AI(o),i};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const B=globalThis;class st extends W{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=re(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return q}}st._$litElement$=!0,st.finalized=!0,(Pt=B.litElementHydrateSupport)==null||Pt.call(B,{LitElement:st});const ft=B.litElementPolyfillSupport;ft==null||ft({LitElement:st}),(B.litElementVersions??(B.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const oe=o=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(o,t)}):customElements.define(o,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ae={attribute:!0,type:String,converter:H,reflect:!1,hasChanged:lt},ne=(o=ae,t,e)=>{const{kind:s,metadata:i}=e;let r=globalThis.litPropertyMetadata.get(i);if(r===void 0&&globalThis.litPropertyMetadata.set(i,r=new Map),s==="setter"&&((o=Object.create(o)).wrapped=!0),r.set(e.name,o),s==="accessor"){const{name:a}=e;return{set(d){const c=t.get.call(this);t.set.call(this,d),this.requestUpdate(a,c,o,!0,d)},init(d){return d!==void 0&&this.C(a,void 0,o,d),d}}}if(s==="setter"){const{name:a}=e;return function(d){const c=this[a];t.call(this,d),this.requestUpdate(a,c,o,!0,d)}}throw Error("Unsupported decorator location: "+s)};function Mt(o){return(t,e)=>typeof e=="object"?ne(o,t,e):((s,i,r)=>{const a=i.hasOwnProperty(r);return i.constructor.createProperty(r,s),a?Object.getOwnPropertyDescriptor(i,r):void 0})(o,t,e)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function V(o){return Mt({...o,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ce=(o,t,e)=>(e.configurable=!0,e.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(o,t,e),e);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function de(o,t){return(e,s,i)=>{const r=a=>{var d;return((d=a.renderRoot)==null?void 0:d.querySelector(o))??null};return ce(e,s,{get(){return r(this)}})}}const le=w`
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
`;w`
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
`;const he=A`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,pe=A`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`,ue=A`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;Bt=[oe("proxlab-chat-card")];class E extends(It=st,Dt=[Mt({attribute:!1})],jt=[V()],Nt=[V()],zt=[V()],Ht=[V()],Tt=[V()],Ot=[V()],Rt=[V()],Ut=[de(".messages")],It){constructor(){super(...arguments);C(this,"hass",v(p,8,this)),v(p,11,this);C(this,"_config",v(p,12,this)),v(p,15,this);C(this,"_cardConfig",v(p,16,this)),v(p,19,this);C(this,"_messages",v(p,20,this,[])),v(p,23,this);C(this,"_loading",v(p,24,this,!1)),v(p,27,this);C(this,"_inputValue",v(p,28,this,"")),v(p,31,this);C(this,"_recording",v(p,32,this,!1)),v(p,35,this);C(this,"_configLoaded",v(p,36,this,!1)),v(p,39,this);C(this,"_messagesEl",v(p,40,this)),v(p,43,this);C(this,"_mediaRecorder");C(this,"_audioChunks",[])}setConfig(e){if(!e.card_id)throw new Error("Please set a card_id in the card configuration");this._config=e,this._configLoaded=!1}static getConfigElement(){return document.createElement("proxlab-chat-card-editor")}static getStubConfig(){return{type:"custom:proxlab-chat-card",card_id:crypto.randomUUID().slice(0,8)}}getCardSize(){var e;return Math.max(3,Math.ceil((((e=this._cardConfig)==null?void 0:e.card_height)??500)/50))}willUpdate(e){e.has("hass")&&this._config&&!this._configLoaded&&this._loadCardConfig()}async _loadCardConfig(){var e,s;if(!(!this.hass||!((e=this._config)!=null&&e.card_id))){this._configLoaded=!0;try{const i=await this.hass.callWS({type:"proxlab/card/config/get",card_id:this._config.card_id});this._cardConfig=i??void 0,this._messages.length===0&&(i!=null&&i.personality_enabled)&&((s=i==null?void 0:i.personality)!=null&&s.first_mes)&&(this._messages=[{role:"assistant",content:i.personality.first_mes,timestamp:Date.now()}])}catch{}}}render(){var r,a,d,c,g,b,f,M,U;if(!this._config)return A`<ha-card><div class="not-configured">No configuration</div></ha-card>`;if((a=(r=this._cardConfig)==null?void 0:r.allowed_users)!=null&&a.length){const L=(c=(d=this.hass)==null?void 0:d.user)==null?void 0:c.id;if(L&&!this._cardConfig.allowed_users.includes(L))return A``}const e=((g=this._cardConfig)==null?void 0:g.card_height)??500,s=(b=this._cardConfig)!=null&&b.personality_enabled&&((M=(f=this._cardConfig)==null?void 0:f.personality)!=null&&M.name)?this._cardConfig.personality.name:"ProxLab Chat",i=(U=this._cardConfig)==null?void 0:U.avatar;return A`
      <ha-card>
        <div class="card-container" style="height: ${e}px">
          ${this._renderHeader(s,i)}
          ${this._renderMessages()}
          ${this._renderInputBar()}
        </div>
      </ha-card>
    `}_renderHeader(e,s){return A`
      <div class="card-header">
        <div class="avatar">
          ${s?A`<img src="${s}" alt="${e}" />`:e.charAt(0).toUpperCase()}
        </div>
        <div class="header-info">
          <div class="header-name">${e}</div>
          <div class="header-status">
            ${this._loading?"Thinking...":"Online"}
          </div>
        </div>
      </div>
    `}_renderMessages(){return this._messages.length===0&&!this._loading?A`
        <div class="messages" style="flex: 1">
          <div class="empty-state">
            ${ue}
            <span>Start a conversation</span>
          </div>
        </div>
      `:A`
      <div class="messages">
        ${this._messages.map(e=>{var s;return A`
            <div class="message ${e.role}">
              <div class="bubble">${e.content}</div>
              ${((s=this._cardConfig)==null?void 0:s.show_metadata)!==!1&&e.metadata?A`<div class="meta">
                    ${e.metadata.model?e.metadata.model:""}
                    ${e.metadata.tokens?` | ${e.metadata.tokens} tokens`:""}
                    ${e.metadata.duration_ms?` | ${(e.metadata.duration_ms/1e3).toFixed(1)}s`:""}
                  </div>`:m}
            </div>
          `})}
        ${this._loading?A`<div class="typing">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>`:m}
      </div>
    `}_renderInputBar(){var e;return A`
      <div class="input-bar">
        ${(e=this._cardConfig)!=null&&e.stt_enabled?A`<button
              class="btn-icon btn-mic ${this._recording?"recording":""}"
              @click=${this._toggleRecording}
              title="Voice input"
            >
              ${pe}
            </button>`:m}
        <input
          type="text"
          placeholder="Type a message..."
          .value=${this._inputValue}
          @input=${s=>{this._inputValue=s.target.value}}
          @keydown=${s=>{s.key==="Enter"&&!s.shiftKey&&(s.preventDefault(),this._sendMessage())}}
          ?disabled=${this._loading}
        />
        <button
          class="btn-icon btn-send"
          @click=${this._sendMessage}
          ?disabled=${this._loading||!this._inputValue.trim()}
          title="Send"
        >
          ${he}
        </button>
      </div>
    `}async _sendMessage(){var s,i;const e=this._inputValue.trim();if(!(!e||this._loading||!this.hass||!((s=this._config)!=null&&s.card_id))){this._messages=[...this._messages,{role:"user",content:e,timestamp:Date.now()}],this._inputValue="",this._loading=!0,this._scrollToBottom();try{const r=await this.hass.callWS({type:"proxlab/card/invoke",card_id:this._config.card_id,message:e,conversation_id:`card_${this._config.card_id}`});this._messages=[...this._messages,{role:"assistant",content:r.response_text||"No response",timestamp:Date.now(),metadata:{agent_name:r.agent_name,tokens:r.tokens,duration_ms:r.duration_ms,model:r.model,tool_results:r.tool_results}}],r.tts_audio_url&&((i=this._cardConfig)!=null&&i.tts_voice)&&this._playAudio(r.tts_audio_url)}catch(r){const a=r instanceof Error?r.message:String(r);this._messages=[...this._messages,{role:"assistant",content:`Error: ${a}`,timestamp:Date.now()}]}finally{this._loading=!1,this._scrollToBottom()}}}_scrollToBottom(){requestAnimationFrame(()=>{this._messagesEl&&(this._messagesEl.scrollTop=this._messagesEl.scrollHeight)})}_playAudio(e){try{new Audio(e).play().catch(()=>{})}catch{}}async _toggleRecording(){var e;if(this._recording){(e=this._mediaRecorder)==null||e.stop(),this._recording=!1;return}try{const s=await navigator.mediaDevices.getUserMedia({audio:!0});this._audioChunks=[],this._mediaRecorder=new MediaRecorder(s),this._mediaRecorder.ondataavailable=i=>{i.data.size>0&&this._audioChunks.push(i.data)},this._mediaRecorder.onstop=async()=>{s.getTracks().forEach(r=>r.stop());const i=new Blob(this._audioChunks,{type:"audio/webm"});await this._transcribeAudio(i)},this._mediaRecorder.start(),this._recording=!0}catch{}}async _transcribeAudio(e){try{const s=new FileReader,i=await new Promise(r=>{s.onloadend=()=>{const a=s.result;r(a.split(",")[1]||"")},s.readAsDataURL(e)});if(this.hass.config.components.includes("stt")){const r=await this.hass.callWS({type:"stt/stream",audio_data:i,language:this.hass.language||"en"});r!=null&&r.text&&(this._inputValue=r.text)}}catch{}}}return p=Kt(It),R(p,5,"hass",Dt,E),R(p,5,"_config",jt,E),R(p,5,"_cardConfig",Nt,E),R(p,5,"_messages",zt,E),R(p,5,"_loading",Ht,E),R(p,5,"_inputValue",Tt,E),R(p,5,"_recording",Ot,E),R(p,5,"_configLoaded",Rt,E),R(p,5,"_messagesEl",Ut,E),E=R(p,0,"ProxLabChatCard",Bt,E),C(E,"styles",le),v(p,1,E),window.customCards=window.customCards||[],window.customCards.push({type:"proxlab-chat-card",name:"ProxLab Chat",description:"Chat with ProxLab agents directly from your dashboard",preview:!0,documentationURL:"https://github.com/travisfinch1983/ha-proxlab"}),n.ProxLabChatCard=E,Object.defineProperty(n,Symbol.toStringTag,{value:"Module"}),n})({});

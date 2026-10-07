import '@testing-library/jest-dom/vitest'
// JSDOM lacks animationend; fire it when style.animationDuration is set
Object.defineProperty(Element.prototype, "animate", {
  configurable: true,
  value: function() { return { finished: Promise.resolve() }; },
});

const origDispatch = EventTarget.prototype.dispatchEvent;
EventTarget.prototype.dispatchEvent = function(ev){
  const res = origDispatch.call(this, ev);
  if(ev.type==="animationend") return res;
  if(ev.type==="transitionend") return res;
  return res;
};

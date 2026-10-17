/* Bounce Cards — vanilla port of the BounceCards React component
   (supplied for the reviews/trusted-by section).
   A fanned deck of cards that pop in staggered, spread on hover, push
   neighbours aside, and bounce when clicked. Cards are the children of
   the [data-bounce-cards] element, authored in HTML. */

(function () {
  "use strict";

  var PATTERN = [1, 0.5, -0.3, -1, 0.2, 0.75, -0.6, 0.35, -0.85, 0.1];

  var clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function mount(root) {
    var cards = Array.prototype.slice.call(root.children);
    if (!cards.length) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var settings = {};
    var slots = [];

    var layout = () => {
      var wide = root.clientWidth >= 640;
      settings.cardSize = wide ? 190 : 150;
      settings.spread = wide ? 128 : 96;
      settings.arc = -26;
      settings.delay = 0.35;
      settings.stagger = 0.08;
      settings.bounciness = 0.6;
      settings.pushDistance = wide ? 96 : 72;
      settings.hoverScale = 1.06;
      root.style.setProperty("--bounce-size", settings.cardSize + "px");
      var middle = (cards.length - 1) / 2;
      var reach = Math.max(1, middle);
      slots = cards.map((_, i) => {
        var offset = i - middle;
        return {
          x: offset * settings.spread,
          y: settings.arc * Math.pow(offset / reach, 2),
          rotate: 10 * PATTERN[i % PATTERN.length]
        };
      });
    };
    layout();

    var bodies = [];
    var state = { hovered: -1, time: 0 };
    var raf = 0;
    var last = 0;

    var body = i => {
      if (!bodies[i]) {
        var slot = slots[i] || { x: 0, y: 0, rotate: 0 };
        bodies[i] = {
          x: slot.x,
          y: slot.y,
          rotate: slot.rotate,
          scale: reduce ? 1 : 0,
          vx: 0,
          vy: 0,
          vr: 0,
          vs: 0,
          born: state.time
        };
      }
      return bodies[i];
    };

    var step = (value, velocity, target, stiffness, damping, dt) => {
      var next = velocity + ((target - value) * stiffness - velocity * damping) * dt;
      return [value + next * dt, next];
    };

    var frame = now => {
      raf = 0;
      var dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
      last = now;
      state.time += dt;

      var hovered = state.hovered;
      var popStiffness = 170;
      var popDamping = 2 * (1 - 0.85 * settings.bounciness) * Math.sqrt(popStiffness);
      var moveStiffness = 210;
      var moveDamping = 2 * (reduce ? 1 : 0.72) * Math.sqrt(moveStiffness);
      var substeps = Math.ceil(dt / (1 / 240));
      var h = dt / substeps;
      var moving = 0;

      for (var i = 0; i < slots.length; i++) {
        var el = cards[i];
        if (!el) continue;
        var card = body(i);
        var slot = slots[i];
        var appeared = reduce || state.time - card.born >= settings.delay + i * settings.stagger;
        var targetX = slot.x;
        var targetY = slot.y;
        var targetRotate = slot.rotate;
        var targetScale = appeared ? 1 : 0;
        if (hovered >= 0 && appeared) {
          if (i === hovered) {
            targetY = slot.y - settings.cardSize * 0.04;
            targetRotate = 0;
            targetScale = settings.hoverScale;
          } else {
            targetX = slot.x + Math.sign(i - hovered) * settings.pushDistance;
          }
        }
        for (var k = 0; k < substeps; k++) {
          var r1 = step(card.x, card.vx, targetX, moveStiffness, moveDamping, h);
          card.x = r1[0]; card.vx = r1[1];
          var r2 = step(card.y, card.vy, targetY, moveStiffness, moveDamping, h);
          card.y = r2[0]; card.vy = r2[1];
          var r3 = step(card.rotate, card.vr, targetRotate, moveStiffness, moveDamping, h);
          card.rotate = r3[0]; card.vr = r3[1];
          if (reduce) {
            card.scale = targetScale;
            card.vs = 0;
          } else {
            var r4 = step(card.scale, card.vs, targetScale, popStiffness, popDamping, h);
            card.scale = r4[0]; card.vs = r4[1];
          }
        }
        moving +=
          Math.abs(card.vx) +
          Math.abs(card.vy) +
          Math.abs(card.vr) +
          Math.abs(card.vs) * 100 +
          Math.abs(targetX - card.x) +
          Math.abs(targetY - card.y) +
          Math.abs(targetRotate - card.rotate) +
          Math.abs(targetScale - card.scale) * 100 +
          (appeared ? 0 : 1);
        el.style.transform = "translate(-50%, -50%) translate3d(" + card.x.toFixed(2) + "px, " + card.y.toFixed(2) + "px, 0) rotate(" + card.rotate.toFixed(3) + "deg) scale(" + Math.max(0, card.scale).toFixed(4) + ")";
      }

      cards.forEach((el, i) => {
        el.style.zIndex = String(i === state.hovered ? slots.length + 1 : i + 1);
        el.toggleAttribute("data-active", i === state.hovered);
      });

      if (moving > 0.02) raf = requestAnimationFrame(frame);
    };

    var wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    var pick = event => {
      var rect = root.getBoundingClientRect();
      var px = event.clientX - rect.left - rect.width / 2;
      var py = event.clientY - rect.top - rect.height / 2;
      var best = -1;
      var distance = Infinity;
      slots.forEach((slot, i) => {
        var gap = Math.abs(px - slot.x);
        if (gap < distance) {
          distance = gap;
          best = i;
        }
      });
      if (best < 0) return -1;
      var slot = slots[best];
      var half = settings.cardSize / 2;
      if (Math.abs(py - slot.y) > half + 12 || distance > half + 12) return -1;
      if (state.hovered >= 0 && state.hovered !== best) {
        var current = slots[state.hovered];
        if (current && Math.abs(px - current.x) - distance < 6) return state.hovered;
      }
      return best;
    };

    var onMove = event => {
      var next = pick(event);
      if (next !== state.hovered) {
        state.hovered = next;
        wake();
      }
    };

    var onLeave = () => {
      if (state.hovered !== -1) {
        state.hovered = -1;
        wake();
      }
    };

    var onClick = event => {
      var index = pick(event);
      if (index < 0) return;
      var card = bodies[index];
      if (card && !reduce) card.vs -= 2.2;
      wake();
    };

    var onFocus = event => {
      var index = cards.indexOf(event.target);
      if (index >= 0) {
        state.hovered = index;
        wake();
      }
    };

    var onKey = event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      var index = cards.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      if (bodies[index] && !reduce) bodies[index].vs -= 2.2;
      wake();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("click", onClick);
    root.addEventListener("focusin", onFocus);
    root.addEventListener("focusout", onLeave);
    root.addEventListener("keydown", onKey);

    if ("ResizeObserver" in window) {
      var lastWide = root.clientWidth >= 640;
      new ResizeObserver(() => {
        var nowWide = root.clientWidth >= 640;
        if (nowWide !== lastWide) {
          lastWide = nowWide;
          layout();
          wake();
        }
      }).observe(root);
    }

    // play the staggered pop-in the first time the deck scrolls into view
    if ("IntersectionObserver" in window) {
      var seen = false;
      new IntersectionObserver((entries, obs) => {
        if (entries.some(e => e.isIntersecting) && !seen) {
          seen = true;
          obs.disconnect();
          wake();
        }
      }, { threshold: 0.3 }).observe(root);
    } else {
      wake();
    }
  }

  document.querySelectorAll("[data-bounce-cards]").forEach(mount);
})();

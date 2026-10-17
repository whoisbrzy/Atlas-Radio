/* Gradient Blinds — vanilla WebGL2 port of the GradientBlinds background
   (ported from the React component supplied for the hero).
   Animated gradient blind slats with mouse spotlight, sway, click ripples,
   and an intro settle. Mounts on any element with [data-gradient-blinds]. */

(function () {
  "use strict";

  var MAX_COLORS = 8;
  var MAX_WAVES = 4;
  var INTRO_SECONDS = 1.8;
  var RIPPLE_SECONDS = 1.6;

  var VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  var FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3 uColors[8];
uniform int uColorCount;
uniform float uLightMode;
uniform float uShine;
uniform float uRelief;
uniform float uGlow;
uniform float uSway;
uniform float uSwayTime;
uniform float uHover;
uniform vec4 uWaves[4];
uniform float uIntro;
uniform float uGrainTime;
uniform vec3 uLightColor;
uniform float uPerspective;
uniform float uGradientShift;

out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 rotate2D(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec2 blindSpace(vec2 uv0) {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = uv0 * 2.0 - 1.0;
  p.x *= aspect;
  vec2 pr = rotate2D(p, uAngle);
  pr.x /= aspect;
  vec2 uv = pr * 0.5 + 0.5;
  if (abs(uPerspective) > 0.001) {
    float k = uPerspective * 2.2;
    uv.x = (exp(k * uv.x) - 1.0) / (exp(k) - 1.0);
  }
  if (uDistort > 0.0) {
    float a = uv.y * 6.0;
    float b = uv.x * 6.0;
    float w = 0.01 * uDistort;
    uv.x += sin(a) * w;
    uv.y += cos(b) * w;
  }
  return uv;
}

vec3 gradientColor(float t) {
  float tt = clamp(t, 0.0, 1.0);
  int count = max(uColorCount, 2);
  float scaled = tt * float(count - 1);
  int seg = min(int(floor(scaled)), count - 2);
  float f = scaled - float(seg);
  if (tt >= 1.0) return uColors[count - 1];
  return mix(uColors[seg], uColors[seg + 1], f);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv0 = frag / uResolution;
  vec2 uvMod = blindSpace(uv0);

  float count = max(uBlindCount, 1.0);
  float stripePhase = uvMod.x * count;
  float pixel = max(fwidth(stripePhase), 1e-5);

  float t = uvMod.x;
  if (uGradientShift != 0.0) {
    t = 1.0 - abs(1.0 - fract((t + uGradientShift) * 0.5) * 2.0);
  }
  if (uMirror > 0.5) {
    t = 1.0 - abs(1.0 - 2.0 * fract(t));
  }
  vec3 base = gradientColor(t);

  vec2 offset = uMouse / uResolution;
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float spot = (1.0 - 2.0 * pow(d / r, uSpotlightSoftness)) * uSpotlightOpacity;

  float slat = floor(stripePhase);
  float s = stripePhase - slat;
  float stripeAA = clamp(count * 1.25 / min(uResolution.x, uResolution.y), 0.001, 0.12);
  float edgeBlend = 1.0 - smoothstep(0.0, stripeAA, min(s, 1.0 - s));
  float across = mix(s, 0.5, edgeBlend);
  float ramp = uShineFlip > 0.5 ? 1.0 - across : across;

  float unit = min(uResolution.x, uResolution.y);
  float reach = max(uSpotlightRadius, 0.05) * unit;
  vec2 toLight = uMouse - frag;
  float nearLight = exp(-dot(toLight, toLight) / (reach * reach));

  float tilt = 0.0;
  float pulse = 0.0;
  if (uSway > 0.0) {
    tilt += uSway * 0.5 * sin(uSwayTime * 0.9 + slat * 0.55) * (0.6 + 0.4 * sin(uSwayTime * 0.37 + slat * 0.21));
  }
  tilt += uHover * nearLight * 0.7;
  float aspect = uResolution.x / uResolution.y;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    float age = uTime - wave.z;
    if (age < 0.0 || age > 1.60) continue;
    float life = age / 1.60;
    vec2 origin = blindSpace(wave.xy / uResolution);
    float slats = abs(slat + 0.5 - origin.x * count);
    float front = age * max(count, 4.0) * 0.95;
    float k = (slats - front) / (0.8 + life * 1.2);
    float along = (uvMod.y - origin.y) / max(0.42 + life * 0.5, 0.01);
    float fade = (1.0 - life) * (1.0 - life);
    float ring = exp(-k * k) * exp(-along * along) * fade * smoothstep(0.0, 0.2, age);
    tilt += ring * 0.9;
    pulse += ring;
  }
  if (uIntro < 1.0) {
    float settle = smoothstep(0.0, 1.0, clamp(uIntro * 1.5 - uv0.x * 0.5, 0.0, 1.0));
    tilt -= (1.0 - settle) * 1.2;
  }

  float edge = ramp;
  float calm = 1.0 - 0.6 * clamp(spot, 0.0, 1.0);
  ramp = pow(clamp(ramp, 0.0, 1.0), exp(tilt * 0.9));
  ramp *= 1.0 - 0.3 * min(pulse, 1.0) * calm;
  float crease = uRelief * 0.38 * smoothstep(0.62, 1.0, ramp);
  float sheen = uShine * exp(-pow((edge - 0.035) / 0.07, 2.0)) * (0.3 + 0.7 * nearLight) * (1.0 - edgeBlend);

  vec3 lit = spot > 0.0 ? uLightColor * spot : vec3(spot);
  lit += uLightColor * min(pulse, 1.0) * 0.35 * calm;
  vec3 revealSignal = lit + base - vec3(ramp + crease);

  vec3 col;
  if (uLightMode > 0.5) {
    vec3 luma = vec3(0.2126, 0.7152, 0.0722);
    float peak = max(base.r, max(base.g, base.b));
    float low = min(base.r, min(base.g, base.b));
    float chroma = (peak - low) / max(peak, 0.0001);
    vec3 hue = base / max(peak, 0.0001);
    hue = clamp(mix(vec3(dot(hue, luma)), hue, 1.3), 0.0, 1.0);
    hue *= mix(1.0, 0.82, smoothstep(0.55, 0.9, dot(hue, luma)));
    vec3 tint = mix(base, hue, smoothstep(0.06, 0.28, chroma));
    vec3 revealed = clamp(revealSignal, 0.0, 1.0);
    float coverage = max(revealed.r, max(revealed.g, revealed.b));
    float stroke = 1.0 - smoothstep(pixel, pixel * 2.2, edge);
    col = mix(vec3(1.0), tint, 0.72 * smoothstep(0.0, 1.0, coverage));
    col = mix(col, tint * 0.85, stroke * clamp(coverage * 1.5, 0.0, 1.0) * 0.7);
    col = mix(col, vec3(1.0), clamp(sheen, 0.0, 1.0) * 0.5);
    float grain = max(0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5, 0.0);
    col = clamp(col - vec3(grain * uNoise * 0.12 * coverage), 0.0, 1.0);
  } else {
    vec3 haze = base * uGlow * 0.4 * smoothstep(0.0, 1.0, spot) * (0.4 + 0.6 * ramp);
    col = revealSignal + haze + mix(base, uLightColor, 0.45) * sheen * 0.7;
    vec3 over = max(col - 0.8, 0.0);
    col = min(col, vec3(0.8)) + 0.2 * (1.0 - exp(-over / 0.2));
    float luma = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
    float grain = 0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5;
    col += grain * uNoise * (0.45 + 0.55 * smoothstep(0.0, 0.5, luma));
  }

  float presence = smoothstep(0.0, 0.65, uIntro);
  col = uLightMode > 0.5 ? mix(vec3(1.0), col, presence) : col * presence;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  var clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  var compile = (gl, type, source) => {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };

  var link = gl => {
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(program, i);
      if (!info) continue;
      var name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  };

  var hexToRGB = hex => {
    var c = String(hex || '')
      .replace('#', '')
      .padEnd(6, '0');
    var r = parseInt(c.slice(0, 2), 16) / 255;
    var g = parseInt(c.slice(2, 4), 16) / 255;
    var b = parseInt(c.slice(4, 6), 16) / 255;
    return [r || 0, g || 0, b || 0];
  };

  var prepStops = stops => {
    var base = (stops && stops.length ? stops : ['#FF9FFC', '#5227FF']).slice(0, MAX_COLORS);
    if (base.length === 1) base.push(base[0]);
    while (base.length < MAX_COLORS) base.push(base[base.length - 1]);
    var flat = new Float32Array(MAX_COLORS * 3);
    for (var i = 0; i < MAX_COLORS; i++) flat.set(hexToRGB(base[i]), i * 3);
    var count = Math.max(2, Math.min(MAX_COLORS, stops ? stops.length : 2));
    return { flat, count };
  };

  function mount(container) {
    var canvas = container.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      container.appendChild(canvas);
    }
    var gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false
    });
    if (!gl) return;
    var shader = link(gl);
    if (!shader) return;
    var u = shader.uniforms;
    var vao = gl.createVertexArray();

    var ds = container.dataset;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var settings = {
      gradientColors: ds.colors ? ds.colors.split(",").map(s => s.trim()) : ["#ff6a42", "#ff4a1c", "#b12d0c", "#3a0f05"],
      angle: ds.angle ? parseFloat(ds.angle) : 20,
      noise: 0.3,
      blindCount: 16,
      blindMinWidth: 60,
      mouseDampening: 0.15,
      mirrorGradient: true,
      spotlightRadius: 0.75,
      spotlightSoftness: 0.8,
      spotlightOpacity: 1,
      distortAmount: 0,
      shineDirection: "left",
      lightColor: "#ffd7c9",
      perspective: 0,
      gradientSpeed: 0.2,
      shine: 0.4,
      relief: 0.35,
      glow: 0.8,
      sway: 0.35,
      speed: 1,
      hoverTilt: 0.6,
      clickEffect: "ripple",
      idle: "drift",
      intro: !reduce,
      lightMode: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    };

    var view = { width: 1, height: 1, ratio: 1 };
    var pointer = { x: 0, y: 0, inside: false };
    var light = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ready: false };
    var waves = new Float32Array(MAX_WAVES * 4);
    var waveIndex = 0;
    var hover = 0;
    var time = 0;
    var swayTime = 0;
    var shift = 0;
    var grainTime = 0;
    var introClock = settings.intro && !reduce ? 0 : 1;
    var colorStops = prepStops(settings.gradientColors);
    var raf = 0;
    var recoveryTimer = 0;
    var last = 0;
    var visible = true;

    var blindTotal = () => {
      if (settings.blindMinWidth && settings.blindMinWidth > 0) {
        var byWidth = Math.max(1, Math.floor(view.width / settings.blindMinWidth));
        return Math.max(1, settings.blindCount ? Math.min(settings.blindCount, byWidth) : byWidth);
      }
      return Math.max(1, settings.blindCount);
    };

    var draw = () => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(shader.program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform2f(u.uMouse, light.x * view.ratio, (view.height - light.y) * view.ratio);
      gl.uniform1f(u.uAngle, (settings.angle * Math.PI) / 180);
      gl.uniform1f(u.uNoise, settings.noise);
      gl.uniform1f(u.uBlindCount, blindTotal());
      gl.uniform1f(u.uSpotlightRadius, settings.spotlightRadius);
      gl.uniform1f(u.uSpotlightSoftness, settings.spotlightSoftness);
      gl.uniform1f(u.uSpotlightOpacity, settings.spotlightOpacity);
      gl.uniform1f(u.uMirror, settings.mirrorGradient ? 1 : 0);
      gl.uniform1f(u.uDistort, settings.distortAmount);
      gl.uniform1f(u.uShineFlip, settings.shineDirection === "right" ? 1 : 0);
      gl.uniform3fv(u.uColors, colorStops.flat);
      gl.uniform1i(u.uColorCount, colorStops.count);
      gl.uniform1f(u.uLightMode, settings.lightMode ? 1 : 0);
      gl.uniform1f(u.uShine, settings.shine);
      gl.uniform1f(u.uRelief, settings.relief);
      gl.uniform1f(u.uGlow, settings.glow);
      gl.uniform1f(u.uSway, reduce ? 0 : settings.sway);
      gl.uniform1f(u.uSwayTime, swayTime);
      gl.uniform1f(u.uHover, hover * settings.hoverTilt);
      gl.uniform4fv(u.uWaves, waves);
      gl.uniform1f(u.uIntro, introClock);
      gl.uniform1f(u.uGrainTime, grainTime);
      gl.uniform3fv(u.uLightColor, hexToRGB(settings.lightColor));
      gl.uniform1f(u.uPerspective, settings.perspective);
      gl.uniform1f(u.uGradientShift, shift);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };

    var aim = () => {
      if (pointer.inside) {
        light.tx = pointer.x;
        light.ty = pointer.y;
      } else if (settings.idle === "center") {
        light.tx = view.width / 2;
        light.ty = view.height / 2;
      } else if (settings.idle === "drift" && !reduce) {
        light.tx = view.width * (0.5 + 0.22 * Math.sin(swayTime * 0.23) + 0.05 * Math.sin(swayTime * 0.61 + 1.3));
        light.ty = view.height * (0.5 + 0.16 * Math.sin(swayTime * 0.31 + 0.7) + 0.04 * Math.sin(swayTime * 0.83));
      }
    };

    var follow = dt => {
      var tau = settings.mouseDampening;
      if (tau <= 0) {
        light.x = light.tx;
        light.y = light.ty;
        light.vx = 0;
        light.vy = 0;
        return;
      }
      var omega = 2.4 / tau;
      var k = omega * omega;
      var c = 2 * omega;
      var steps = Math.max(1, Math.ceil(dt / 0.008));
      var h = dt / steps;
      for (var i = 0; i < steps; i++) {
        light.vx += (k * (light.tx - light.x) - c * light.vx) * h;
        light.vy += (k * (light.ty - light.y) - c * light.vy) * h;
        light.x += light.vx * h;
        light.y += light.vy * h;
      }
    };

    var resize = () => {
      view.width = Math.max(1, container.clientWidth);
      view.height = Math.max(1, container.clientHeight);
      view.ratio = Math.min(settings.dpr || window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(view.width * view.ratio));
      canvas.height = Math.max(1, Math.round(view.height * view.ratio));
      if (!light.ready) {
        light.ready = true;
        light.x = light.tx = view.width / 2;
        light.y = light.ty = view.height / 2;
      }
      draw();
      wake();
    };

    var frame = now => {
      raf = 0;
      if (!visible) {
        // off-screen: idle cheaply, but self-recover when it scrolls back
        recoveryTimer = setTimeout(wake, 500);
        return;
      }
      var dt = last ? clamp((now - last) / 1000, 0.001, 1 / 20) : 1 / 60;
      last = now;
      time += dt;
      if (!reduce) {
        swayTime += dt * settings.speed;
        shift = (shift + dt * settings.gradientSpeed * 0.06) % 2;
      }
      grainTime = Math.floor(time * 24) * 17.13;
      if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS);
      hover += ((pointer.inside ? 1 : 0) - hover) * (1 - Math.exp(-dt / 0.35));
      aim();
      follow(dt);
      for (var i = 0; i < MAX_WAVES; i++) {
        if (waves[i * 4 + 3] > 0 && time - waves[i * 4 + 2] > RIPPLE_SECONDS) waves[i * 4 + 3] = 0;
      }
      draw();
      var settling =
        Math.abs(light.tx - light.x) > 0.05 ||
        Math.abs(light.ty - light.y) > 0.05 ||
        Math.abs(light.vx) + Math.abs(light.vy) > 0.05 ||
        Math.abs((pointer.inside ? 1 : 0) - hover) > 0.002;
      var active =
        settling ||
        introClock < 1 ||
        waves.some((value, index) => index % 4 === 3 && value > 0) ||
        (!reduce &&
          (settings.noise > 0 ||
            settings.gradientSpeed !== 0 ||
            (settings.sway > 0 && settings.speed > 0) ||
            (settings.idle === "drift" && !pointer.inside)));
      if (active) raf = requestAnimationFrame(frame);
    };

    function wake() {
      if (!raf && !recoveryTimer) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    var locate = event => {
      var rect = container.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
    };

    var onPointerMove = event => {
      var p = locate(event);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.inside = p.inside;
      if (p.inside) wake();
    };

    var onPointerDown = event => {
      var p = locate(event);
      if (!p.inside || reduce || settings.clickEffect !== "ripple") return;
      var o = waveIndex * 4;
      waves[o] = p.x * view.ratio;
      waves[o + 1] = (view.height - p.y) * view.ratio;
      waves[o + 2] = time;
      waves[o + 3] = 1;
      waveIndex = (waveIndex + 1) % MAX_WAVES;
      wake();
    };

    var onPointerLeave = () => {
      pointer.inside = false;
      wake();
    };

    var onVisibility = () => {
      last = 0;
      wake();
    };

    new ResizeObserver(resize).observe(container);
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) wake();
    }).observe(container);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
  }

  document.querySelectorAll("[data-gradient-blinds]").forEach(mount);
})();

// Animated hero background: a vertical night-to-day gradient whose bands are
// warped by slow fbm noise. Plain WebGL1, no dependencies.

const vert = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const frag = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

vec3 c0 = vec3(0.0);
vec3 c1 = vec3(0.031, 0.078, 0.180);   // #08142E
vec3 c2 = vec3(0.075, 0.165, 0.400);   // #132A66
vec3 c3 = vec3(0.137, 0.278, 0.651);   // #2347A6
vec3 c4 = vec3(0.227, 0.400, 0.847);   // #3A66D8
vec3 c5 = vec3(0.451, 0.576, 0.902);   // #7393E6
vec3 c6 = vec3(0.737, 0.816, 0.965);   // #BCD0F6
vec3 c7 = vec3(1.0);

vec3 ramp(float t){
  if (t < 0.20) return c0;
  if (t < 0.34) return mix(c0, c1, (t - 0.20) / 0.14);
  if (t < 0.48) return mix(c1, c2, (t - 0.34) / 0.14);
  if (t < 0.60) return mix(c2, c3, (t - 0.48) / 0.12);
  if (t < 0.70) return mix(c3, c4, (t - 0.60) / 0.10);
  if (t < 0.82) return mix(c4, c5, (t - 0.70) / 0.12);
  if (t < 0.92) return mix(c5, c6, (t - 0.82) / 0.10);
  return mix(c6, c7, clamp((t - 0.92) / 0.08, 0.0, 1.0));
}

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;                       // 0 = top
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime * 0.05;

  float n1 = fbm(p * 1.4 + vec2(t, -t * 0.7));
  float n2 = fbm(p * 2.8 - vec2(t * 0.6, t * 0.35) + n1 * 1.5);
  float wave = sin(uv.x * 4.0 + uTime * 0.22 + n1 * 3.0) * 0.018;

  // Keep the very top solid black and the bottom solid white.
  float band = smoothstep(0.12, 0.32, uv.y) * (1.0 - smoothstep(0.88, 0.99, uv.y));
  float y = uv.y + ((n1 - 0.5) * 0.17 + (n2 - 0.5) * 0.07 + wave) * band;

  vec3 col = ramp(clamp(y, 0.0, 1.0));

  // Soft luminous ribbons in the blue band.
  float ribbons = pow(max(0.0, n2 - 0.52), 2.0) * 2.4;
  col += vec3(0.32, 0.45, 0.95) * ribbons * band * smoothstep(0.35, 0.7, uv.y);

  // Fine film grain.
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.022 * band;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function initHeroShader(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  };

  let raf = 0;
  let visible = true;
  const start = performance.now();
  const frame = (now) => {
    raf = 0;
    if (!visible) return;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  });
  io.observe(canvas);

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  canvas.classList.add('is-live');
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    canvas.classList.remove('is-live');
  };
}

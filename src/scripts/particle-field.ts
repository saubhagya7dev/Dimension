export interface Fragment { u: number; v: number; seed: number; phase: number; x: number; y: number; free: boolean; }
export interface FlightBox { x: number; y: number; width: number; height: number; }
interface State { progress: number; source: FlightBox; target: FlightBox; start: number; end: number; }

/** Static point sprites, one vertex per fragment; path maths runs on the GPU. */
export function createParticleField(canvas: HTMLCanvasElement, atlas: HTMLCanvasElement, particles: Fragment[], step: number) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return createFallback(canvas, atlas, particles, step);
  const vertex = `#version 300 es
    precision highp float;
    layout(location=1) in vec4 fragmentData;
    layout(location=2) in vec2 sprite;
    layout(location=3) in vec4 driftData;
    uniform sampler2D motion;
    uniform vec4 sourceBox, targetBox;
    uniform vec2 viewport, timeline, atlasSize;
    uniform float progress, cell, pixelRatio;
    flat out vec2 spriteOrigin;
    out float opacity;
    void main(){
      float local=(progress-fragmentData.w*.45)/.5;
      spriteOrigin=sprite;
      opacity=0.;
      if(local<=0. || local>=1.){gl_Position=vec4(2.,2.,0.,1.);return;}
      float samplePosition=local*255.;
      int sampleIndex=int(floor(samplePosition));
      vec3 curve=mix(texelFetch(motion,ivec2(sampleIndex,0),0).xyz,texelFetch(motion,ivec2(min(255,sampleIndex+1),0),0).xyz,fract(samplePosition));
      float t=curve.x, inv=1.-t, seed=fragmentData.z;
      vec2 origin=sourceBox.xy+fragmentData.xy*sourceBox.zw;
      origin.y-=timeline.x+fragmentData.w*.45*(timeline.y-timeline.x);
      vec2 end=targetBox.xy+fragmentData.xy*targetBox.zw;
      float burst=curve.z;
      float radius=(12.+seed*65.)*burst;
      float angle=driftData.z;
      float freePath=seed<.3?1.:0.;
      float wave=curve.y;
      float wander=wave*wave*mix(14.,65.,freePath);
      float frequency=driftData.w;
      vec2 pos=inv*inv*inv*origin+3.*inv*inv*t*(origin+vec2(45.,-55.))
        +3.*inv*t*t*(end+vec2(90.,30.))+t*t*t*end;
      pos+=vec2(driftData.x*radius+sin(t*frequency*3.+angle)*wander,
        driftData.y*radius*.8+cos(t*frequency*2.+angle)*wander*.7);
      vec2 size=mix(sourceBox.zw,targetBox.zw,t)*cell/atlasSize*(1.-wave*.45);
      opacity=1.-wave*mix(.12,.3,freePath);
      float diameter=max(size.x,size.y)*pixelRatio;
      gl_PointSize=max(1.,diameter);
      opacity*=min(1.,diameter)*min(1.,diameter);
      gl_Position=vec4(pos.x/viewport.x*2.-1.,1.-pos.y/viewport.y*2.,0.,1.);
    }`;
  const fragment = `#version 300 es
    precision highp float;
    uniform sampler2D atlas;
    uniform vec2 atlasSize;
    uniform float cell;
    flat in vec2 spriteOrigin;
    in float opacity;
    out vec4 color;
    void main(){vec2 uv=(spriteOrigin+gl_PointCoord*cell)/atlasSize;float a=texture(atlas,uv).a*opacity;if(a<.005)discard;color=vec4(vec3(a),a);}`;
  function shader(type: number, text: string) {
    const result = gl!.createShader(type)!;
    gl!.shaderSource(result, text); gl!.compileShader(result);
    if (!gl!.getShaderParameter(result, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(result) || 'Particle shader failed');
    return result;
  }
  const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Particle program failed');
  gl.useProgram(program);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  function attribute(location: number, size: number, data: Float32Array, divisor: number) {
    const buffer = gl!.createBuffer()!; buffers.push(buffer);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer); gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.STATIC_DRAW);
    gl!.enableVertexAttribArray(location); gl!.vertexAttribPointer(location, size, gl!.FLOAT, false, 0, 0);
    gl!.vertexAttribDivisor(location, divisor);
  }
  attribute(1, 4, new Float32Array(particles.flatMap(p => [p.u,p.v,p.seed,p.phase])), 0);
  attribute(2, 2, new Float32Array(particles.flatMap(p => [p.x,p.y])), 0);
  attribute(3, 4, new Float32Array(particles.flatMap(p => {
    const angle=p.seed*Math.PI*17+p.v*35;
    return [Math.cos(angle),Math.sin(angle),angle,3+p.seed*6];
  })), 0);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  // Shared timing curves are computed once, rather than trig per vertex/frame.
  const motionData = new Float32Array(256*4);
  for(let i=0;i<256;i++){
    const local=i/255,t=local*local*(3-2*local),f=Math.max(0,Math.min(1,(local-.4)/.45));
    motionData[i*4]=t;
    motionData[i*4+1]=Math.sin(Math.PI*t);
    motionData[i*4+2]=Math.sin(Math.PI*Math.min(1,local/.58))*(1-f*f*(3-2*f));
  }
  const motionTexture=gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,motionTexture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,256,1,0,gl.RGBA,gl.FLOAT,motionData);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(uniform('motion'),1);gl.uniform1i(uniform('atlas'),0);gl.activeTexture(gl.TEXTURE0);
  const locations = { source: uniform('sourceBox'), target: uniform('targetBox'), viewport: uniform('viewport'), timeline: uniform('timeline'), progress: uniform('progress'), ratio: uniform('pixelRatio') };
  gl.uniform2f(uniform('atlasSize'), atlas.width, atlas.height); gl.uniform1f(uniform('cell'), step);
  let lost = false;
  let pending: WebGLSync | null = null;
  let busyFrames = 0;
  let nextDraw = 0;
  function contextLost(event: Event) { event.preventDefault(); lost = true; canvas.style.opacity = '0'; }
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.dataset.renderer = 'webgl2';
  canvas.dataset.vertices = String(particles.length);
  return {
    get available() { return !lost; },
    resize(width: number, height: number) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(locations.viewport, width, height);
      gl.uniform1f(locations.ratio, canvas.width / width);
    },
    render(state: State) {
      if (lost) return true;
      const now=performance.now();
      if(now+.5<nextDraw)return false;
      // Never build an unbounded GPU queue when several effects share the GPU.
      // Retry the latest scroll position next frame instead of queuing old ones.
      if (pending) {
        const status = gl.clientWaitSync(pending, 0, 0);
        if (status === gl.TIMEOUT_EXPIRED) {
          if (import.meta.env.DEV) canvas.dataset.gpuBusyFrames = String(++busyFrames);
          return false;
        }
        gl.deleteSync(pending); pending = null;
      }
      const { source: s, target: d } = state;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(locations.source, s.x,s.y,s.width,s.height);
      gl.uniform4f(locations.target, d.x,d.y,d.width,d.height);
      gl.uniform2f(locations.timeline, state.start,state.end); gl.uniform1f(locations.progress, state.progress);
      // One vertex per fragment, rather than six copies of the expensive path
      // calculation for each quad. The original SVG fragment atlas is retained.
      gl.drawArrays(gl.POINTS, 0, particles.length);
      pending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      nextDraw=now+1000/60;
      return true;
    },
    destroy() {
      canvas.removeEventListener('webglcontextlost', contextLost);
      if (pending) gl.deleteSync(pending);
      buffers.forEach(buffer => gl.deleteBuffer(buffer)); gl.deleteVertexArray(vao);
      gl.deleteTexture(texture); gl.deleteTexture(motionTexture); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
    },
  };
}

/** Bounded fallback for devices without WebGL2. Full SVG solids stay in the DOM. */
function createFallback(canvas: HTMLCanvasElement, atlas: HTMLCanvasElement, particles: Fragment[], step: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No particle drawing context');
  let width = 1, height = 1;
  const stride = Math.max(1, Math.ceil(particles.length / 1800));
  canvas.dataset.renderer = 'canvas2d';
  return {
    available: true,
    resize(w: number,h: number) { width=w; height=h; ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0); },
    render(state: State) {
      ctx.clearRect(0,0,width,height);
      const { source:s,target:d,progress }=state;
      for(let i=0;i<particles.length;i+=stride){
        const p=particles[i],local=(progress-p.phase*.45)/.5;
        if(local<=0||local>=1)continue;
        const t=local*local*(3-2*local),inv=1-t;
        const sx=s.x+p.u*s.width,sy=s.y+p.v*s.height-state.start-p.phase*.45*(state.end-state.start);
        const tx=d.x+p.u*d.width,ty=d.y+p.v*d.height;
        const wave=Math.sin(Math.PI*t),angle=p.seed*Math.PI*17+p.v*35;
        const burst=Math.sin(Math.PI*Math.min(1,local/.58))*(1-Math.max(0,Math.min(1,(local-.4)/.45)));
        const radius=(12+p.seed*65)*burst,wander=wave*wave*(p.free?65:14),frequency=3+p.seed*6;
        const x=inv**3*sx+3*inv*inv*t*(sx+45)+3*inv*t*t*(tx+90)+t**3*tx+Math.cos(angle)*radius+Math.sin(t*frequency*3+angle)*wander;
        const y=inv**3*sy+3*inv*inv*t*(sy-55)+3*inv*t*t*(ty+30)+t**3*ty+Math.sin(angle)*radius*.8+Math.cos(t*frequency*2+angle)*wander*.7;
        const w=step/atlas.width*(s.width*inv+d.width*t)*(1-wave*.45),h=step/atlas.height*(s.height*inv+d.height*t)*(1-wave*.45);
        ctx.globalAlpha=1-wave*(p.free?.3:.12);
        ctx.drawImage(atlas,p.x,p.y,Math.min(step,atlas.width-p.x),Math.min(step,atlas.height-p.y),x-w/2,y-h/2,w,h);
      }
      ctx.globalAlpha=1;
      return true;
    },
    destroy() {},
  };
}

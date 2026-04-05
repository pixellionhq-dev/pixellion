import React, { useEffect, useRef } from 'react';

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
    if (!gl) return;

    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // A smooth, dark, premium fluid fluid gradient shader (Apple/Google style)
    const fragmentShaderSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;

      // Color palette (Light, airy, Apple/Google style)
      vec3 col1 = vec3(0.98, 0.98, 0.99); // Crisp white
      vec3 col2 = vec3(0.92, 0.94, 0.97); // Very soft frost blue
      vec3 col3 = vec3(0.96, 0.96, 0.98); // Off-white

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        uv = uv * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        // Fluid distortion (slower, more elegant)
        float t = u_time * 0.12;
        vec2 p = uv;
        p.x += sin(t + p.y * 1.5) * 0.3;
        p.y += cos(t * 0.6 + p.x * 1.2) * 0.3;
        
        float v = sin(p.x * 2.5 + t) * cos(p.y * 1.5 - t * 0.8);
        
        // Combine colors based on elegant fluid flow
        vec3 color = mix(col1, col2, smoothstep(-1.0, 1.0, v));
        color = mix(color, col3, smoothstep(-0.5, 0.5, sin(uv.x * uv.y * 3.0 + t)));

        // Subtle noise for frosted/matte texture
        float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 0.008;
        color -= noise;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const createShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1,  1, -1,  -1,  1,
      -1,  1,  1, -1,   1,  1
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');

    let animationFrameId;

    const render = (time) => {
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;

      // Match canvas internal resolution to display size (scaling down slightly for performance is also an option, but raw is fine for this simple shader)
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, time * 0.001);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(vbo);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

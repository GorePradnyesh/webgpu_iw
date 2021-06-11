/*
**
*/

function CheckWebGPU()
{
    if (!navigator.gpu || GPUBufferUsage.COPY_SRC === undefined) 
    {
        console.log("no WebGPU. Mithrandir will not come");
        return false;
    }
    else
    {
        console.log("WebGPU enabled. Mithrandir might come.\n\nAt Dawn Look to the east");
        return true;
    }
}


const vertexBufferInput = new Float32Array([
  // float2 coordinates, float2 normalized sample coords
  -0.5, 0.5, 0.0, 0.0,    // Top Left
  -0.5, -0.5, 0.0, 1.0,   // BL
  0.5, 0.5, 1.0, 0.0,     // TR
  0.5, 0.5, 1.0, 0.0,     // TR
  -0.5, -0.5, 0.0, 1.0,   // BL
  0.5, -0.5, 1.0, 1.0,    // BR
]);
const vertexInputSizeBytes = 4 * 4;  // 4 floats
const positionOffset = 0;
const coordOffset = 4 * 2;

// TODO: Move to another file
const vertexSource = `
struct VertexOutput {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] nCoords : vec2<f32>;
};

[[stage(vertex)]]
fn main(
  [[location(0)]] vertexPosition: vec2<f32>,
  [[location(1)]] nCoords: vec2<f32>)-> VertexOutput
{
  var output: VertexOutput;
  output.Position = vec4<f32>(vertexPosition, 0.0, 1.0);
  output.nCoords = nCoords;
  return output;
}
`;

// TODO: Move to another file   
const fragSource = `
[[group(0), binding(0)]] var img_sampler: sampler;
[[group(0), binding(1)]] var img_texture: texture_2d<f32>;

[[stage(fragment)]]
fn main([[location(0)]] nCoords: vec2<f32>) -> [[location(0)]] vec4<f32>
{
  return textureSample(img_texture, img_sampler, nCoords);
}
`;

// GPUVertexBufferLayout 
// https://www.w3.org/TR/webgpu/#dictdef-gpuvertexbufferlayout
const vertexBufferLayout = {
  arrayStride: vertexInputSizeBytes,
  attributes: [
    {
      shaderLocation: 0,
      offset: positionOffset,
      format: 'float32x2',
    },
    {
      shaderLocation: 1,
      offset: coordOffset,
      format: 'float32x2',
    }
  ],
};

class RendererContext
{
    async Init(canvas, device)
    {
        console.log("Look to my coming, at first light, on the fifth day");
        this.canvas = canvas;
        this.device = device;
        
        const gpuContext = this.canvas.getContext("gpupresent");
    
        // Create a vertex buffer from the vertex input data. Map, copy, Unmap
        this.verticesBuffer = this.device.createBuffer({
          size: vertexBufferInput.byteLength,
          usage: GPUBufferUsage.VERTEX,
          mappedAtCreation: true,
        });
        new Float32Array(this.verticesBuffer.getMappedRange()).set(vertexBufferInput);
        this.verticesBuffer.unmap();

        // ==========================================
        // Allocate Test buffer
        this.bufferWidth = 64;
        this.bufferHeight = 64;
        this.bytesPerPix = 4 * 4; // ( 4 bytes * 4)
        this.bufferSize = (this.bufferWidth * this.bytesPerPix) * (this.bufferHeight /** this.bytesPerPix*/);
        this.testBuffer = this.device.createBuffer({
          size: this.bufferSize,
          usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
          mappedAtCreation: true
        });
        let dataArray = new Float32Array(this.testBuffer.getMappedRange());
        var i;
        for(i=0; i < 64 * 4 * 64; i=i+4)
        {
          dataArray[i] = 1.0;
          dataArray[i+1] = 0.5;
          dataArray[i+2] = 0.5;
          dataArray[i+3] = 1.0;
        }
        this.testBuffer.unmap();
        this.imageCopyBuffer = {
          buffer: this.testBuffer,
          bytesPerRow: this.bufferWidth * this.bytesPerPix,
          rowPerImage: this.bufferHeight
        };
        
        // Allocate test Texture
        const testTextureDescriptor = {
          size: [this.bufferWidth, this.bufferHeight, 1],
          format: 'rgba32float',
          usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.COPY_DST
        };        
        this.testTexture = this.device.createTexture(testTextureDescriptor);
        this.imageCopyTexture = {texture: this.testTexture};
        // ==========================================

        const swapChainFormat = 'bgra8unorm';

        /* GPUSwapChainDescriptor */
        const swapChainDescriptor = { device: device, format: swapChainFormat };
        
        /* GPUSwapChain */
        this.swapChain = gpuContext.configureSwapChain(swapChainDescriptor);
        
        this.loadColor = { r: 57.0/255, g: 2.0/255, b: 115.0/255, a: 1 };

        this.vertexShaderModule = this.device.createShaderModule({ code: vertexSource});
        this.fragmentShaderModule = this.device.createShaderModule({ code: fragSource});

        this.pipeline = device.createRenderPipeline({
            vertex: {
              module: this.vertexShaderModule,
              entryPoint: 'main',
              buffers: [vertexBufferLayout]
            },
            fragment: {
              module: this.fragmentShaderModule,
              entryPoint: 'main',
              targets: [
                {
                  format: swapChainFormat,
                },
              ],
            },
            primitive: {
              topology: 'triangle-list',
            },
          });
        
        // Create Sample 
        this.sampler = this.device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        });

        // attach the sampler and texture to the pipeline using the uniform bind group
        this.uniformBindGroup = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [            
            {
              binding: 0,
              resource: this.sampler,
            },
            {
              binding: 1,
              resource: this.testTexture.createView()
            },
          ],
        });
        console.log("Init complete"); 
    }    

    async Render()
    {        
        /* GPUTexture */
        this.currentSwapChainTexture = this.swapChain.getCurrentTexture();
        
        /* GPUTextureView */
        this.currentRenderView = this.currentSwapChainTexture.createView();

        const colorAttachmentDescriptor = {
            view: this.currentRenderView,
            loadOp: "clear",
            storeOp: "store",
            loadValue: this.loadColor
        };
        
        /* GPURenderPassDescriptor */
        const renderPassDescriptor = { colorAttachments: [colorAttachmentDescriptor] };
        
        /*** Rendering ***/
        
        /* GPUCommandEncoder */
        const commandEncoder = this.device.createCommandEncoder();
        
        //==========================================
        commandEncoder.copyBufferToTexture(this.imageCopyBuffer, this.imageCopyTexture, [this.bufferWidth, this.bufferHeight, 1]);
        //==========================================

        const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPassEncoder.setPipeline(this.pipeline);
        renderPassEncoder.setBindGroup(0, this.uniformBindGroup);
        renderPassEncoder.setVertexBuffer(0, this.verticesBuffer);
        renderPassEncoder.draw(6, 1, 0, 0);
        renderPassEncoder.endPass();
        
        /* GPUComamndBuffer */
        const commandBuffer = commandEncoder.finish();
        
        /* GPUQueue */
        const queue = this.device.queue;
        queue.submit([commandBuffer]);

        requestAnimationFrame(() => { this.Render() } );
    }

    /*
    **
    */
    async start()
    {
        if(!CheckWebGPU())
        {
            return;
        }

        /** Get Adapater */
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();

        /*** Swap Chain Setup ***/
        
        const canvas = document.querySelector("canvas");
        canvas.width = 600;
        canvas.height = 600;

        await this.Init(canvas, device);
        this.Render()

    }
}

async function RunTriangleAsync()
{
    rendererContext = new RendererContext();
    rendererContext.start();
}
window.addEventListener("DOMContentLoaded", RunTriangleAsync);
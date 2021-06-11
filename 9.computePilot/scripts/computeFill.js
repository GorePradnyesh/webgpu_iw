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


const computeSource=`
[[block]] struct Data
{
  buffer: array<vec4<f32>>;
};

[[group(0), binding(0)]] var<storage, read_write> ioDataBuffer : Data;

[[stage(compute)]]
fn main([[builtin(global_invocation_id)]] global_id: vec3<u32>)
{
  var index: u32 = global_id.y * u32(64) + global_id.x;
  ioDataBuffer.buffer[index] = vec4<f32>(1.0, 0.0, 0.0, 1.0);
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
        this.pixelFormat = 'rgba32float';
        
        // ==========================================
        // Allocate Storage Buffers and Display Texture
        // ==========================================
        this.bufferWidth = 64;
        this.bufferHeight = 64;
        this.bytesPerPix = 4 * 4; // ( sizeof(f32) * channel count ) 
        this.bufferSize = (this.bufferWidth * this.bytesPerPix) * (this.bufferHeight /** this.bytesPerPix*/);
        this.storageBuffer = this.device.createBuffer({
          size: this.bufferSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
          mappedAtCreation: true
        });
        this.storageBuffer.unmap();
        this.imageCopyBuffer = {
          buffer: this.storageBuffer,
          bytesPerRow: this.bufferWidth * this.bytesPerPix, // NOTE: !! Assumin alignment !! 
          rowPerImage: this.bufferHeight
        };
        
        // Allocate test Texture
        const blitTextureDescriptor = {
          size: [this.bufferWidth, this.bufferHeight, 1],
          format: this.pixelFormat,
          usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.COPY_DST
        };        
        this.blitTexture = this.device.createTexture(blitTextureDescriptor);
        this.imageCopyTexture = {texture: this.blitTexture};
        
        // ==========================================
        // Create Compute Pipeline 
        // ==========================================
        this.computeShaderModule = this.device.createShaderModule({code: computeSource}); // load SPIR-V instead
        this.computePipeline = this.device.createComputePipeline({
                                compute:{
                                  module: this.computeShaderModule,
                                  entryPoint: 'main'
                                }
                              });
        this.computeBindGroup = this.device.createBindGroup({
          layout: this.computePipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource:
              {
                buffer: this.storageBuffer
              }
            }
          ]
        });
        // ==========================================
        // Create Render Pipeline 
        // ==========================================
        const swapChainFormat = 'bgra8unorm'; // independent of pixelFormat.

        /* GPUSwapChainDescriptor */
        const swapChainDescriptor = { device: device, format: swapChainFormat };
        
        /* GPUSwapChain */
        this.swapChain = gpuContext.configureSwapChain(swapChainDescriptor);
        
        this.loadColor = { r: 57.0/255, g: 2.0/255, b: 115.0/255, a: 1 };

        this.vertexShaderModule = this.device.createShaderModule({ code: vertexSource});
        this.fragmentShaderModule = this.device.createShaderModule({ code: fragSource});

        this.renderPipeline = device.createRenderPipeline({
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
        
        // Create Sampler
        this.sampler = this.device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        });

        // attach the sampler and texture to the pipeline using the uniform bind group
        this.uniformBindGroup = this.device.createBindGroup({
          layout: this.renderPipeline.getBindGroupLayout(0),
          entries: [            
            {
              binding: 0,
              resource: this.sampler,
            },
            {
              binding: 1,
              resource: this.blitTexture.createView()
            },
          ],
        });
        console.log("Init complete"); 
    }    

    async Render()
    {        
        /*** Rendering ***/
        
        /* GPUCommandEncoder */
        const commandEncoder = this.device.createCommandEncoder();
        
        //==========================================
        // Compute phase to write to buffer
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatch(this.bufferWidth, this.bufferHeight);
        computePass.endPass();

        //==========================================
        // Copy Buffer to Texture
        commandEncoder.copyBufferToTexture(
          this.imageCopyBuffer, 
          this.imageCopyTexture, 
          [this.bufferWidth, this.bufferHeight, 1]);
        
        //==========================================
        // RenderPhase to blit the texture
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
        const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPassEncoder.setPipeline(this.renderPipeline);
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
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
  // float2 coordinates, float4 color
  -0.5, 0.5, 1.0, 0.0, 0.0, 1.0,
  -0.5, -0.5, 0.0, 1.0, 0.0, 1.0,
  0.5, 0.5, 1.0, 0.0, 1.0, 1.0,
  0.5, 0.5, 1.0, 0.0, 1.0, 1.0,
  -0.5, -0.5, 0.0, 1.0, 0.0, 1.0,
  0.5, -0.5, 0.0, 0.0, 1.0, 1.0,
]);
const vertexInputSizeBytes = 4 * 6;  // 6 floats
const positionOffset = 0;
const colorOffset = 4 * 2;

// TODO: Move to another file
const vertexSource = `
struct VertexOutput {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] color : vec4<f32>;
};

[[stage(vertex)]]
fn main(
  [[location(0)]] vertexPosition: vec2<f32>,
  [[location(1)]] color: vec4<f32>)-> VertexOutput
{
  var output: VertexOutput;
  output.Position = vec4<f32>(vertexPosition, 0.0, 1.0);
  output.color = color;
  return output;
}
`;

// TODO: Move to another file   
const fragSource = `
[[stage(fragment)]]
fn main([[location(0)]] color: vec4<f32>) -> [[location(0)]] vec4<f32>
{
  return vec4<f32>(color);
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
      offset: colorOffset,
      format: 'float32x4',
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
        
        const gpuContext = canvas.getContext("gpupresent");
    
        // Create a vertex buffer from the vertex input data. Map, copy, Unmap
        this.verticesBuffer = this.device.createBuffer({
          size: vertexBufferInput.byteLength,
          usage: GPUBufferUsage.VERTEX,
          mappedAtCreation: true,
        });
        new Float32Array(this.verticesBuffer.getMappedRange()).set(vertexBufferInput);
        this.verticesBuffer.unmap();

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

        /*
        const img = document.getElementById('sun_src');        
        await img.decode();
        const imageBitmap = await createImageBitmap(img);
        
        const textureDescriptor = {
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.COPY_DST
        };
        this.imageTexture = this.device.createTexture(textureDescriptor);
        // TODO: copyImageBitmapToTexture deprecated in favour or CopyExternalImageToTexture
        this.device.queue.copyImageBitmapToTexture(
          { imageBitmap },
          { texture: this.imageTexture },
          [imageBitmap.width, imageBitmap.height, 1]
        );
        
        // Create Sample 
        this.sampler = this.device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        });

        // attach the sampler and texture to the pipeline using the uniform bind group
        const uniformBindGroup = device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [            
            {
              binding: 0,
              resource: this.sampler,
            },
            {
              binding: 1,
              resource: this.imageTexture.createView(),
            },
          ],
        });
        */

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
        /* GPURenderPassEncoder */
        const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPassEncoder.setPipeline(this.pipeline);
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

        this.Init(canvas, device);
        this.Render()

    }
}

async function RunTriangleAsync()
{
    rendererContext = new RendererContext();
    rendererContext.start();
}
window.addEventListener("DOMContentLoaded", RunTriangleAsync);
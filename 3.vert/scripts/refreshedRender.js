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

// TODO: Move to another file
const vertexSource = `
let pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5));

[[stage(vertex)]]
fn main([[builtin(vertex_index)]] VertexIndex : u32)
     -> [[builtin(position)]] vec4<f32> 
{
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}
`;

// TODO: Move to another file   
const fragSource = `
[[stage(fragment)]]
fn main() -> [[location(0)]] vec4<f32>
{
  return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}
`;

class RendererContext
{
    Init(canvas, device)
    {
        console.log("Look to my coming, at first light, on the fifth day");
        this.canvas = canvas;
        this.device = device;
        
        const gpuContext = canvas.getContext("gpupresent");
    
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
        renderPassEncoder.draw(3, 1, 0, 0);
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
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


class RendererContext
{
    Init(canvas, device)
    {
        console.log("Look to my coming, at first light, on the fifth day");
        this.canvas = canvas;
        this.device = device;
        
        const gpuContext = canvas.getContext("gpupresent");
    
        /* GPUSwapChainDescriptor */
        const swapChainDescriptor = { device: device, format: "bgra8unorm" };
        
        /* GPUSwapChain */
        this.swapChain = gpuContext.configureSwapChain(swapChainDescriptor);
        
        
        this.loadColor = { r: 57.0/255, g: 2.0/255, b: 115.0/255, a: 1 };
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
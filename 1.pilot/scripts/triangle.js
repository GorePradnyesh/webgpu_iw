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

/*
**
*/
async function RunTriangleAsync()
{
    console.log("Look to my coming, at first light, on the fifth day");
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

    const gpuContext = canvas.getContext("gpupresent");
    
    /* GPUSwapChainDescriptor */
    const swapChainDescriptor = { device: device, format: "bgra8unorm" };
    /* GPUSwapChain */
    const swapChain = gpuContext.configureSwapChain(swapChainDescriptor);
    
    /*** Render Pass Setup ***/
    
    /* Acquire Texture To Render To */
    
    /* GPUTexture */
    const swapChainTexture = swapChain.getCurrentTexture();
    /* GPUTextureView */
    const renderView = swapChainTexture.createView();
    
    /* Clear Color */
    const purple = { r: 57.0/255, g: 2.0/255, b: 115.0/255, a: 1 };
    
    /* GPURenderPassColorATtachmentDescriptor */
    const colorAttachmentDescriptor = {
        view: renderView,
        loadOp: "clear",
        storeOp: "store",
        loadValue: purple
    };
    
    /* GPURenderPassDescriptor */
    const renderPassDescriptor = { colorAttachments: [colorAttachmentDescriptor] };
    
    /*** Rendering ***/
    
    /* GPUCommandEncoder */
    const commandEncoder = device.createCommandEncoder();
    /* GPURenderPassEncoder */
    const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    renderPassEncoder.endPass();
    
    /* GPUComamndBuffer */
    const commandBuffer = commandEncoder.finish();
    
    /* GPUQueue */
    const queue = device.queue;
    queue.submit([commandBuffer]);
}

window.addEventListener("DOMContentLoaded", RunTriangleAsync);
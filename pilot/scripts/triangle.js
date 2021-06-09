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
    const renderAttachment = swapChainTexture.createView();
    
    /* GPUColor */
    const darkBlue = { r: 0.15, g: 0.15, b: 0.5, a: 1 };
    
    /* GPURenderPassColorATtachmentDescriptor */
    const colorAttachmentDescriptor = {
        attachment: renderAttachment,
        loadOp: "clear",
        storeOp: "store",
        clearColor: darkBlue
    };
    
    /* GPURenderPassDescriptor */
    const renderPassDescriptor = { colorAttachments: [colorAttachmentDescriptor] };
    
    /*** Rendering ***/
    
    /* GPUCommandEncoder */
    const commandEncoder = device.createCommandEncoder();
    /* GPURenderPassEncoder */
    const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    renderPassEncoder.setPipeline(renderPipeline);
    renderPassEncoder.setVertexBuffers(vertexBufferSlot, [vertexBuffer], [0]);
    renderPassEncoder.draw(3, 1, 0, 0); // 3 vertices, 1 instance, 0th vertex, 0th instance.
    renderPassEncoder.endPass();
    
    /* GPUComamndBuffer */
    const commandBuffer = commandEncoder.finish();
    
    /* GPUQueue */
    const queue = device.getQueue();
    queue.submit([commandBuffer]);
}

window.addEventListener("DOMContentLoaded", RunTriangleAsync);
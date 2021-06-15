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
  -1.0, 1.0, 0.0, 0.0,    // Top Left
  -1.0, -1.0, 0.0, 1.0,   // BL
  1.0, 1.0, 1.0, 0.0,     // TR
  1.0, 1.0, 1.0, 0.0,     // TR
  -1.0, -1.0, 0.0, 1.0,   // BL
  1.0, -1.0, 1.0, 1.0,    // BR
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

const f32ComputeSource=`
[[block]] struct sourceData
{
  buffer: array<u32>;
};

[[block]] struct operationalData
{
  buffer: array<vec4<f32>>;
};

[[block]] struct ComputeParams
{
  width: u32;
  height: u32;
};

[[group(0), binding(0)]] var<storage, read_write> source : sourceData;
[[group(0), binding(1)]] var outputTexture: texture_storage_2d<rgba8unorm, write>;
[[group(0), binding(2)]] var<uniform> params : ComputeParams;

[[stage(compute)]]
fn main([[builtin(global_invocation_id)]] global_id: vec3<u32>)
{
  var index: u32 = global_id.y * u32(params.width) + global_id.x;
  var readValue: u32 = source.buffer[index];
  var writeValue: vec4<f32> = unpack4x8unorm(readValue);
  var position_i32: vec2<i32> = vec2<i32>(i32(global_id.x), i32(global_id.y));
  textureStore(outputTexture, position_i32, writeValue);
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
        
        // Compute params.
        this.computeParams = new Uint32Array([video.videoWidth, video.videoHeight]);
        this.computeParamsBuffer = device.createBuffer({
          // size: this.computeParams.byteLength,
          size: 8,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });


        this.bufferWidth = video.videoWidth;
        this.bufferHeight = video.videoHeight;
        
        // buffer which contains the copied texture
        this.bytesPerPix = 4; // ( rgba8unorm )         
        this.videoBufferSize = (this.bufferWidth * this.bytesPerPix) * (this.bufferHeight);
        this.videoBuffer = this.device.createBuffer({
          size: this.videoBufferSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true
        });
        this.videoBuffer.unmap();
        this.videoBufferCopy = {
          buffer: this.videoBuffer,
          bytesPerRow: this.bufferWidth * this.bytesPerPix, // NOTE: !! Assumin alignment !! 
          rowPerImage: this.bufferHeight
        };

        // Create the texture to decode video frame to.
        const videoTextureFormat = 'rgba8unorm';
        const videoTextureDescriptor = {
          size:{
            width: video.videoWidth,
            height: video.videoHeight
          },
          format: videoTextureFormat,
          usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.SAMPLED | GPUTextureUsage.COPY_SRC
          // RENDER_ATTACHMENT needed for copyExternalImageToTexture
        };
        this.videoTexture = this.device.createTexture(videoTextureDescriptor);
        this.videoTextureCopySource = {texture: this.videoTexture};

        // Create Operation Texture
        const operationalTextureFormat = 'rgba8unorm';
        const operationalTextureDesc = {
          size:{
            width: video.videoWidth,
            height: video.videoHeight
          },
          format: operationalTextureFormat,
          usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED | GPUTextureUsage.STORAGE 
        };
        this.operationalTexture = this.device.createTexture(operationalTextureDesc);


        // Create Sampler
        this.sampler = this.device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        });
        
        // ==========================================
        // Create Compute Pipeline 
        // ==========================================        

        // f32Compute Source
        this.f32ComputeShaderModule = this.device.createShaderModule({code: f32ComputeSource}); // load SPIR-V instead  
        this.f32ComputePipeline = this.device.createComputePipeline({
          compute:{
            module: this.f32ComputeShaderModule,
            entryPoint: 'main'
          }
        });
        // constants necessary since no sampler. 
        // compute bindings
        this.f32ComputeBindGroup = this.device.createBindGroup({
          layout: this.f32ComputePipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource:
              {
                buffer: this.videoBuffer
              }
            },
            {
              binding: 1,
              resource: this.operationalTexture.createView()
            },
            {
              binding: 2,
              resource: {
                buffer: this.computeParamsBuffer,
              },
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
              resource: this.operationalTexture.createView()
            },            
          ],
        });
        console.log("Init complete"); 
    }    

    async FrameRender()
    {      
      // write computeParams
      this.device.queue.writeBuffer(
        this.computeParamsBuffer,
        0,
        this.computeParams
      );

      createImageBitmap(video).then(videoFrameBitmap =>
        {
          /* GPUCommandEncoder */
          const commandEncoder = this.device.createCommandEncoder();
          const gpuImageCopyExternalImage = {
            source: videoFrameBitmap
          }  
          
          this.device.queue.copyExternalImageToTexture(
              gpuImageCopyExternalImage,
              { texture: this.videoTexture },
              {
                width: video.videoWidth,
                height: video.videoHeight,
              }
          );

          commandEncoder.copyTextureToBuffer(
            this.videoTextureCopySource,
            this.videoBufferCopy,
            [video.videoWidth, video.videoHeight, 1]);

          const f32ComputePass = commandEncoder.beginComputePass();
          f32ComputePass.setPipeline(this.f32ComputePipeline);
          f32ComputePass.setBindGroup(0, this.f32ComputeBindGroup);
          f32ComputePass.dispatch(video.videoWidth, video.videoHeight);
          f32ComputePass.endPass();

          
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

          requestAnimationFrame(() => { this.FrameRender() } );  

        } // End of then block
      );  // Enf of then function
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
        canvas.width = 860;
        canvas.height = 540;

        await this.Init(canvas, device);
        // this.Render()
        this.FrameRender()

    }
}

async function RunTriangleAsync()
{
    rendererContext = new RendererContext();
    rendererContext.start();
}

// Tap the video element to start playing.
video = document.getElementById('video_src');
video.load();
video.play();
video.addEventListener('loadeddata', RunTriangleAsync);
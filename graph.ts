import MyPlugin from "main";
import { ItemView, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import { Chart, registerables } from "chart.js";
import zoomPlugin from 'chartjs-plugin-zoom';


export const GRAPH_VIEW_TYPE = "graph-similar-notes";


export class GraphSimilarView extends ItemView {
    mainCanvas: HTMLElement;
    leaf: WorkspaceLeaf;
    myPlugin: MyPlugin;

    constructor(leaf: WorkspaceLeaf, myplugin:MyPlugin) {
        super(leaf);
        this.leaf=leaf
        this.myPlugin=myplugin
    }
    
      
    async onOpen() {
        Chart.register(zoomPlugin)
        Chart.register(...registerables);
        const container = this.containerEl.children[1];
        container.empty();
        // this.viewEl = container.createDiv()
        // this.viewEl = this.containerEl.children[1].createDiv()
        this.mainCanvas = this.containerEl.createEl("canvas",{cls:"graph_canvas"})
        this.updateView()
  
    }
    
    async updateView(){


        const data = {
        datasets: [{
            label: 'Notes',
            pointRadius: 7, 
            // pointHitRadius: 10, 
            data: await this.getDataPoints(),
            backgroundColor: 'rgb(255, 99, 132)',
            
            }],
        };
        
        console.log("data config",data)
                
        
        const ctx = this.mainCanvas.getContext('2d')
        if(ctx){
            const options = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true
                        }
                    }],
                    x: {
                      display: false, 
                    },
                    y: {
                      display: false, 
                    },
                },
                onClick:function(ev,ctx){
                    const index= parseInt(ctx[0]["index"])
                    const path = data["datasets"][0]["data"][index]["file_path"]
                    // if(path){
                        
                    // }
                    
                },
                plugins: {
                    zoom:{
                        zoom: {
                            wheel: {
                              enabled: true,
                            },
                            pinch: {
                              enabled: true
                            },
                            mode: 'xy',
                            drag:true,
                            sensitivity:0.2
                            // drag:{
                            //     enabled:true
                            // }
                        }
                    }
                    ,
                    legend: {
                        display: false, // Hide the legend
                    },
                    tooltip: {
                        dragData: {
                            showTooltip: true, // Display tooltips during dragging
                        },
                        zoom: {
                            zoom: {
                              wheel: {
                                enabled: true,
                              },
                              pinch: {
                                enabled: true
                              },
                              mode: 'xy',
                            }
                        },
                        callbacks: {
                            label: function(ctx) {
                                // console.log(ctx);
                                // let label = ctx.dataset.labels[ctx.dataIndex];
                                const label = data["datasets"][0]["data"][ctx.dataIndex]["name"]
                                const path = data["datasets"][0]["data"][ctx.dataIndex]["path"]
                                
                                return label;
                            }
                        }
                    }
                }
            }

            new Chart(ctx, {
                type: 'scatter',
                data: data,
                options: options             
              });
        }
        
    }


    async getDataPoints(){
        const files= this.app.vault.getMarkdownFiles()
        let file_path = ""

        for (let i =0;i<files.length;i++){
            const content = await this.app.vault.cachedRead(files[i])
            if(content){
                file_path = files[i].path
                break
            }
            
        }

        const res = await this.myPlugin.vectorHelper.twoDimensionQuery(file_path,100)
        if(!res){return []}

        const arr = res["data"]["Get"][this.myPlugin.settings.weaviateClass]
        
        const dp = []
        arr.map(v=>{
            const x = v["_additional"]["featureProjection"]["vector"][0]
            const y = v["_additional"]["featureProjection"]["vector"][1]
            const path = v["path"]
            const name = v["filename"]
            
            dp.push({x:x,y:y,file_path:path,name:name})
        })

        return dp        
    }


      
    async onClose() {
        // Nothing to clean up.
    }
  
    getIcon(): string {
        return "search"
    }
  
    getViewType(): string {
        return GRAPH_VIEW_TYPE
    }
    getDisplayText(): string {
        return "Match up"
    }

}
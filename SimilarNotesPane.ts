import MyPlugin, { SUGGESTION_EXTENSION_ID } from "main";
import { ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";
export const VIEW_TYPE = "similar-notes";


export class SimilarNotesPane extends ItemView {
    listEl: HTMLElement;
    leaf: WorkspaceLeaf;
    myPlugin: MyPlugin;

    constructor(leaf: WorkspaceLeaf, myplugin:MyPlugin) {
        super(leaf);
        this.leaf=leaf
        this.myPlugin=myplugin
    }
    
  
    getViewType() {
      return VIEW_TYPE;
    }
  
  
    async onOpen() {
      const container = this.containerEl.children[1];
      container.empty();
      

      this.listEl = container.createDiv()
      this.updateView()


      this.registerEvent(this.app.vault.on('create', (f) => {
        this.updateView()
      }));
    
      this.registerEvent(this.app.vault.on('modify', (f) => {
        this.updateView()
      }));
    
      this.registerEvent(this.app.vault.on('delete', (f) => {
        this.updateView()
      }));
    
      this.registerEvent(this.app.vault.on('rename', (f) => {
        this.updateView()
      }));

      this.registerEvent(this.app.workspace.on('active-leaf-change',f=>{
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const isFile = view?.file?.path
        if(isFile){
          this.updateView()
        }
      }))

      

    }


    async updateView(){
        if(this.myPlugin.vectorHelper){
          const queryText= await this.myPlugin.getCurrentQuery()
          
          if(queryText && queryText.trim()){
                
              const view = this.app.workspace.getActiveViewOfType(MarkdownView);
              const currentFilePath = view?.file?.path
              if(!currentFilePath){return}

              // this.myPlugin.vectorHelper.queryText(queryText,this.myPlugin.settings.limit)
              this.myPlugin.vectorHelper.queryWithNoteId(currentFilePath,this.myPlugin.settings.limit+1,this.myPlugin.settings.distanceLimit,this.myPlugin.settings.autoCut ) // add one so current can be removed
              .then(similarFiles=>{
                if(!similarFiles){return}

                this.listEl.empty()                
                this.listEl.createEl("h5",{text:"Suggestions",cls:"similar_head"})
                
                const fileFromDatabase = similarFiles['data']['Get'][this.myPlugin.settings.weaviateClass]
  
                //
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const currentFilePath = view?.file?.path
                const cleanFileList = fileFromDatabase.filter(item=>currentFilePath && currentFilePath != item.path)

                cleanFileList.map(file=>{

                      const file_name = file['filename']
                      const file_path = file['path']
                      const file_similarity = this.myPlugin.convertToSimilarPercentage(file["_additional"]["distance"])
                      const opacity_val = parseFloat(file_similarity)*.01
                      const itemElement= this.listEl.createEl("div",{cls:"similar_item"})
  
                      itemElement.createEl("p",{text:file_name,cls:"similar_file_name"})
                      itemElement.createEl("p",{text:file_similarity,cls:"similar_percent"})
                      itemElement.style.opacity = `${opacity_val}`
                      
                    

                    itemElement.addEventListener('click', (event: MouseEvent) => {
                      this.myPlugin.focusFile(file_path)
                    });

                    itemElement.addEventListener('mouseenter',(event)=>{    
                       app.workspace.trigger("hover-link",{
                        source: SUGGESTION_EXTENSION_ID,
                        event:event,
                        hoverParent: itemElement.parentElement,
                        targetEl: itemElement,
                        linktext: file['filename'],
                        sourcePath: file['path']
                      })
                    })

                })
      
              })

          }else{
            this.renderEmpty()
          }
        }else{
          this.renderEmpty()
        }

    }

    renderEmpty(){
      this.listEl.empty()
      this.listEl.createEl("h5",{text:"Suggestions",cls:"similar_head"})

      this.listEl.createEl("p",{text:"Nothing to show"})
      this.listEl.createEl("small",{text:"Select any file that have any content in it to show suggestions"})
      
    }


  
    async onClose() {
      // Nothing to clean up.
    }

    getDisplayText() {
      return "Suggestion"
    }

    getIcon(): string {
      return "search"
    }
  
  }
  
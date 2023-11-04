import {
	ViewUpdate,
	PluginValue,
	EditorView,
    ViewPlugin

} from "@codemirror/view";
import MyPlugin, { SUGGESTION_EXTENSION_ID } from "main";
import { MarkdownView ,editorInfoField} from "obsidian";



 
export const GetSuggestionExtension=(app:MyPlugin)=>
ViewPlugin.fromClass(class SuggExtension implements PluginValue {
	el:HTMLElement
    currentFilePath:string
    view:EditorView
	

	constructor(view: EditorView) {
		this.view=view
		
		const oldEl = view.dom.querySelector("#top-text") as HTMLElement

		if(oldEl){
			this.el=oldEl
			return
		}


		const parent = view.dom.querySelector(".cm-sizer")
		const addTextBeforeThis = view.dom.querySelector(".cm-contentContainer");
		
		this.el = document.createElement("div");
    this.el.addClass("suggestion_on_note")
		this.el.id="top-text"
		
		if(addTextBeforeThis){
			parent?.insertBefore(this.el,addTextBeforeThis)
      this.updateList()
		}

    this.registerObsidianEvents()
		
	}

    registerObsidianEvents(){
        app.registerEvent(app.app.vault.on('create', (f) => {
            this.updateList()
          }));
        
          app.registerEvent(app.app.vault.on('modify', (f) => {

            this.updateList()
          }));
        
          app.registerEvent(app.app.vault.on('delete', (f) => {
            this.updateList()
          }));
        
          app.registerEvent(app.app.vault.on('rename', (f) => {
            this.updateList()
          }));
    
          app.registerEvent(app.app.workspace.on('active-leaf-change',f=>{
            const view = app.app.workspace.getActiveViewOfType(MarkdownView);
            const isFile = view?.file?.path
            if(isFile){
              this.updateList()
            }
          }))
    
    }

    async updateList(){

      if(!app.settings.inDocMatchNotes){
        return
      }
        const editorField = this.view.state.field(editorInfoField)
        if(!editorField){
          return
        }

        const file =  editorField.file;
        if(!file){return}
        const currentFilePath = file.path


        const queryText= await app.getCurrentQuery()
          
        if(queryText && queryText.trim()){
      

            app.vectorHelper.queryWithNoteId(currentFilePath,app.settings.limit+1, app.settings.distanceLimit,app.settings.autoCut) // adding 1 to exclude current note
            // app.vectorHelper.queryWithNoteId(currentFilePath,3)
            .then(similarFiles=>{
              if(!similarFiles){return}
              console.log("sugg ex similarFiles",similarFiles)
              const fileFromDatabase = similarFiles['data']['Get'][app.settings.weaviateClass]

            //   //
            // const view = app.app.workspace.getActiveViewOfType(MarkdownView);
            // const currentFilePath = view?.file?.path
        
            this.el.empty()
            const cleanFileList = fileFromDatabase.filter(item=>currentFilePath && currentFilePath != item.path)

            if(cleanFileList.length>0){
                this.el.createEl("p",{"text":`Similar notes:`,cls:"suggestion_on_note_item_text"})
                
            }else{
                this.el.createEl("p",{"text":"No similar file found",cls:"suggestion_on_note_item_text"})
            }
        

            cleanFileList.map(file=>{

                const file_name = file['filename']
                const file_similarity = app.convertToSimilarPercentage(file["_additional"]["distance"])
                const opacity_val = parseFloat(file_similarity)*.01
                // const itemElement= this.el.createEl("p",{cls:"suggestion_on_note_item"})

                // const itemElement= this.el.createEl("p",{text:file_name,cls:"suggestion_on_note_item"})
                const itemElement= this.el.createEl("a",{"text":file_name,"href":file['filepath'],cls:"suggestion_on_note_item"})
                // itemElement.createEl("p",{text:file_similarity,cls:"similar_percent"})
                itemElement.style.opacity = `${opacity_val}`
                
                

                itemElement.addEventListener('click', (event: MouseEvent) => {
                    app.focusFile(file['path'])
                });

                itemElement.addEventListener('mouseenter',(event)=>{
                  app.app.workspace.trigger("hover-link",{
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
        }  
       
    }


    
	
	async update(update: ViewUpdate) {
        // const file:TFile =  this.view.state.field(editorInfoField).file ;
        
        // if (!file) {
        //     this.decorations = Decoration.none;
        //     return;
        // }
        // if (update.docChanged) {
        //     console.log("doc change")
        //     // this.updateList()
        // }else if (update.viewportChanged) {
        //     console.log("viewportChanged")
        //     // this.updateList()
        // }
	}
  
	destroy() {	}
      

})

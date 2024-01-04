import { WeaviateFile } from '.src/main';
import {
    ViewUpdate,
    PluginValue,
    EditorView,
    ViewPlugin
} from "@codemirror/view";
import MyPlugin, { SIDE_PANE_HOVER_ID } from "./main"


export const GetOnNoteViewExtension = (myPlugin: MyPlugin) =>
    ViewPlugin.fromClass(class OnNoteViewExtension implements PluginValue {
        el: HTMLElement
        currentFilePath: string
        view: EditorView

        constructor(view: EditorView) {
            // console.log("init OnNoteViewExtension")
            this.view = view
            const oldEl = view.dom.querySelector("#top-text") as HTMLElement

            // reuse old element
            if (oldEl) {
                this.el = oldEl
                this.updateList()
                return
            }

            // create a note suggestion element at top
            const parent = view.dom.querySelector(".cm-sizer")
            const addTextBeforeThis = view.dom.querySelector(".cm-contentContainer");

            this.el = document.createElement("div");
            this.el.addClass("suggestion_on_note")
            this.el.id = "top-text"


            if (addTextBeforeThis) {
                parent?.insertBefore(this.el, addTextBeforeThis)
                this.updateList()
            }


            myPlugin.registerEvent(myPlugin.app.vault.on('create', () => { this.updateList() }))
            myPlugin.registerEvent(myPlugin.app.vault.on('modify', () => { this.updateList() }))
            myPlugin.registerEvent(myPlugin.app.vault.on('rename', () => { this.updateList() }))
            myPlugin.registerEvent(myPlugin.app.vault.on('delete', () => { this.updateList() }))
            myPlugin.registerEvent(myPlugin.app.workspace.on('file-open', () => { this.updateList() }))

        }


        update(update: ViewUpdate): void {

        }

        async updateList() {
            if(!myPlugin.settings.inDocMatchNotes) return
            const currentFile = await myPlugin.getCurrentOpenedFile()
            if (!currentFile) return

            myPlugin.vectorServer.getExtensionNoteList(currentFile)
                .then((similarFiles) => {
                    if (!similarFiles) return


                    const fileFromDatabase: WeaviateFile[] = similarFiles['data']['Get'][myPlugin.settings.weaviateClass]
                    const cleanFileList: WeaviateFile[] = fileFromDatabase.filter(item => currentFile.path && currentFile.path != item.path)


                    this.el.empty()
                    cleanFileList.map((file) => {
                        const file_name = file.filename
                        const file_similarity = myPlugin.vectorServer.convertToSimilarPercentage(file._additional.distance)
                        const opacity_val = parseFloat(file_similarity) * .01

                        const itemElement = this.el.createEl("a",
                            { "text": file_name, "href": file.path, cls: "suggestion_on_note_item" }
                        )
                        itemElement.style.opacity = `${opacity_val}`


                        itemElement.addEventListener('click', (event: MouseEvent) => {
                            myPlugin.focusFile(file.path, null)
                        });

                        itemElement.addEventListener('mouseenter', (event) => {
                            myPlugin.app.workspace.trigger("hover-link", {
                                source: SIDE_PANE_HOVER_ID,
                                event: event,
                                hoverParent: itemElement.parentElement,
                                targetEl: itemElement,
                                linktext: file_name,
                                sourcePath: file.path
                            })
                        })
                    })
                })

        }

        destroy(): void {

            if (this.view.dom.querySelector("#top-text")) {
                // console.log("clear suggestion")
                this.view.dom.querySelector("#top-text")?.empty()
            }
        }

    })
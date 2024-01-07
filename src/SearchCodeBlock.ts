import { MarkdownPostProcessorContext, parseYaml } from "obsidian";
import MyPlugin, { CODE_HOVER_ID, WeaviateFile } from "./main";

interface CodeYaml {
    text: string;
    tags: string[];
    limit: number
    showPercentage: boolean
    autoCut: number
    distanceLimit: number
}

export const GetSearchCodeBlock = (myPlugin: MyPlugin) => {

    function populateItem(file: WeaviateFile, listEl: HTMLElement) {
        const i = listEl.createEl("li")

        const itemElement = i.createEl("a", {
            "text": file.filename,
            "href": file.path
        })

        itemElement.addEventListener('click', (event: MouseEvent) => {
            myPlugin.focusFile(file.path, null)
        });

        itemElement.addEventListener('mouseenter', (event) => {
            myPlugin.app.workspace.trigger("hover-link", {
                source: CODE_HOVER_ID,
                event: event,
                hoverParent: itemElement.parentElement,
                targetEl: itemElement,
                linktext: file.filename,
                sourcePath: file.path
            })
        })
    }


    return (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const codeYaml: CodeYaml = parseYaml(source)
        const text = codeYaml.text ? codeYaml.text : ""
        const tags = codeYaml.tags ? codeYaml.tags : []
        const limit = codeYaml.limit ? codeYaml.limit : myPlugin.settings.limit
        const yamlAutoCut = codeYaml.autoCut != null ? codeYaml.autoCut : myPlugin.settings.autoCut
        const yamlDistanceLimit = codeYaml.distanceLimit != null ? codeYaml.distanceLimit : myPlugin.settings.distanceLimit
        const showPercentage = codeYaml.showPercentage ? codeYaml.showPercentage : myPlugin.settings.showPercentageOnCodeQuery

        el.createEl('small', { text: "AI Note suggestion: loading...", cls: "empty_match" })


        myPlugin.vectorServer.getCodeBlockNoteList(text, tags, limit, yamlDistanceLimit, yamlAutoCut)
            .then((similarFiles) => {

                if (!similarFiles) return
                
                const fileFromDatabase: WeaviateFile[] = similarFiles['data']['Get'][myPlugin.settings.weaviateClass]
                const cleanFileList: WeaviateFile[] = fileFromDatabase.filter(item => ctx.sourcePath && ctx.sourcePath != item.path)

                if (cleanFileList) {
                    el.empty()

                    const listEl = el.createEl('ul', { cls: "suggestion_code" })

                    cleanFileList.map((file) => {
                        populateItem(file, listEl)
                    })

                } else {
                    el.createEl('small', { text: "AI Note suggestion: No file matches!", cls: "empty_match" })
                }
            })
            .catch(e => {
                el.createEl('small', { text: "AI Note suggestion: error matching file!", cls: "empty_match" })
            })


    }
}
import {  SuggestModal, } from "obsidian";
import MyPlugin, { WeaviateFile } from "./main";


export class SearchNoteModal extends SuggestModal<WeaviateFile> {
  private myPlugin:MyPlugin

  constructor(myPlugin:MyPlugin) {
    super(myPlugin.app)
    this.myPlugin=myPlugin

  }

  // Returns all available suggestions.
  async getSuggestions(query: string): Promise<WeaviateFile[]> {
    if (!query) return []
    const similarFiles = await this.myPlugin.vectorServer.getSearchModalQueryNoteList(query)
    if (!similarFiles) return []
    const fileFromDatabase: WeaviateFile[] = similarFiles['data']['Get'][this.myPlugin.settings.weaviateClass]
    return fileFromDatabase
  }

  // Renders each suggestion item.
  renderSuggestion(note: WeaviateFile, el: HTMLElement) {
    const file_similarity = this.myPlugin.vectorServer.convertToSimilarPercentage(note._additional.distance)
    el.createEl("div", { text: note.filename });
    el.createEl("small", { text: file_similarity });
  }

  // Perform action on the selected suggestion.
  onChooseSuggestion(note: WeaviateFile, evt: MouseEvent | KeyboardEvent) {
    this.myPlugin.focusFile(note.path, null)
  }
}
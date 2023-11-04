
import {  MarkdownView, Plugin,  SuggestModal, Notice, parseYaml, TFile } from 'obsidian';
import { SimilarNotesPane } from 'SimilarNotesPane';
import VectorHelper from 'vec';
import { MatchUpSettingTab } from 'SettingTab';
// import { GRAPH_VIEW_TYPE, GraphSimilarView } from 'graph';
import { GetSuggestionExtension } from 'SuggestionExtension';

export const VIEW_TYPE = "similar-notes";
export const SUGGESTION_EXTENSION_ID = "similar-SUGGESTION_EXTENSION_ID";


interface CodeYaml {
	text: string;
	tags: string[];
	limit: number
	showPercentage:boolean
	autoCut: number
	distanceLimit: number
}
export interface WeaviateFile{
	content: string
	metadata: string
	tags: string[]
	path: string
	filename: string
	mtime: string
	_additional:{
		id:string
		distance: number	
	}
}

interface MyPluginSettings {
	weaviateAddress: string
	weaviateClass: string
	limit: number
	inDocMatchNotes: boolean
	showPercentageOnCodeQuery:boolean
	autoCut: number
	distanceLimit: number
}



const DEFAULT_SETTINGS: MyPluginSettings = {
	weaviateAddress: 'http://192.168.0.120:3636',
	weaviateClass: 'ObsidianVectors',
	limit: 30,
	inDocMatchNotes: true,
	showPercentageOnCodeQuery:false,
	autoCut: 0,
	distanceLimit: 0
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	vectorHelper: VectorHelper
	statusBarItemEl: HTMLElement
	similarNotesPane: SimilarNotesPane

	//
	timeOut = 1000 * 2

	async onload() {
		await this.loadSettings();
		this.registerView(
			VIEW_TYPE,
			(leaf) => new SimilarNotesPane(leaf, this)
		);
		// this.registerView(
		// 	GRAPH_VIEW_TYPE,
		// 	(leaf) => new GraphSimilarView(leaf, this)
		// );
		this.addSettingTab(new MatchUpSettingTab(this.app, this));
		this.statusBarItemEl = this.addStatusBarItem()
		this.statusBarItemEl.setText('Starting...');


		this.app.workspace.onLayoutReady(() => {
			this.vectorHelper = new VectorHelper(
				this.settings.weaviateAddress,
				this.settings.weaviateClass,
				this.settings.limit,
				this
			)
			this.vectorHelper.initClass()
				.then(classExist => this.scanAllFile())
		
			this.registerEvents()
			this.registerCommands()
			this.registerCodeView()
			this.registerEditorExtension(GetSuggestionExtension(this));
			
			this.registerHoverLinkSource(SUGGESTION_EXTENSION_ID,{
				display: 'Match Up',
				defaultMod: true,
			})
			

		})
	}

	async scanAllFile() {
		const files = this.app.vault.getMarkdownFiles()
		const count = files.length
		let doneScanning = 0
		const countOnDatabase = await this.vectorHelper.countOnDatabase()

		// push new files to database _____________________________________________________
		files.map(async (f, i) => {

			await this.app.vault.cachedRead(f).then(async content => {
				await this.vectorHelper.onUpdateFile(content, f.path, f.name, f.stat.mtime)
					.then(() => {
						doneScanning++
						this.updateStatus(`Scanning ${doneScanning}/${count}`)
					})
					.catch((e) => {
						doneScanning++
						this.updateStatus(`Scanning ${doneScanning}/${count}`)
					})
			})

			if (count == (i + 1)) {
				this.updateStatus(`Done scanning`, true)
				this.updateStatus(`Sitting idle`)
			}
		})

		// delete old file from database _____________________________________________________
		if (countOnDatabase > count) {
			console.log(`Something has been deleted on local, ${countOnDatabase}, ${count}`)
			const weaviateFiles:WeaviateFile[] = await this.vectorHelper.readAllPaths()
			const extraFiles = this.findExtraFiles(weaviateFiles, files)

			extraFiles.map(extra => {
				const extraPath = extra["path"]
				console.log("delete with path", extraPath)
				this.vectorHelper.onDeleteFile(extraPath)
			})
		}

		// if no file is there________________________________________________________________
		if (count == 0) {
			this.updateStatus(`Nothing to scan`, true)
			this.updateStatus(`Sitting idle`)
		}
	}

	updateStatus(text: string, delay = false) {
		if (delay) {
			this.statusBarItemEl.setText(text)
		} else {
			setTimeout(() => this.statusBarItemEl.setText(text), this.timeOut)
		}
	}


	findExtraFiles(weaviateFiles:WeaviateFile[], localFiles: TFile[]) {
		console.log("weaviate", weaviateFiles)
		const extraFiles = weaviateFiles.filter((weaviateFile) => !localFiles.some((file) => file.path === weaviateFile["path"]));
		return extraFiles
	}

	registerEvents() {

		this.registerEvent(this.app.vault.on('create', (f) => {
			this.app.vault.cachedRead(f as TFile).then(content => {
				
				if (content) {
					console.log(`create: ${f.path}`)
					this.vectorHelper.onUpdateFile(content, f.path, f.name, (f as TFile).stat.mtime)
				}
			})
		}))

		this.registerEvent(this.app.vault.on('modify', (f) => {
			this.app.vault.cachedRead(f as TFile).then(content => {


				if (content) {
					console.log(`update: ${f.path}`)
					this.vectorHelper.onUpdateFile(content, f.path, f.name, (f as TFile).stat.mtime)
				} else {
					console.log(`delete file on update: ${f.path}`)
					this.vectorHelper.onDeleteFile(f.path)
				}
			})
		}))

		this.registerEvent(this.app.vault.on('rename', (f, oldPath) => {
			this.app.vault.cachedRead(f as TFile).then(content => {
				if (content) {
					console.log(`rename: ${f.path}`)
					this.vectorHelper.onRename(content, f.path, f.name, (f as TFile).stat.mtime, oldPath)
				}
			})

		}))

		this.registerEvent(this.app.vault.on('delete', (f) => {
			this.vectorHelper.onDeleteFile(f.path)
		}))
	}

	registerCommands() {
		this.addCommand({
			id: 'open-note-suggestion',
			name: 'Open note suggestions (Match up)',
			callback: () => {
				this.activateView()
			}
		});

		// this.addCommand({
		// 	id: 'open--big-note-suggestion',
		// 	name: 'Open notes cluster (Match up)',
		// 	callback: () => {
		// 		this.activeBigView()
		// 	}
		// });

		// 
		// this.addCommand({
		// 	id: 'search-modal-note-suggestion',
		// 	name: 'Search similar notes (Match up)',
		// 	callback: () => {
		// 		new ExampleModal(this.app).open()
		// 	}
		// });

	}



	registerCodeView() {
		this.registerMarkdownCodeBlockProcessor("match", (source, el, ctx) => {

			const codeYaml: CodeYaml = parseYaml(source)
			// console.log("codeYaml",codeYaml)
			const text = codeYaml.text ? codeYaml.text : ""
			const tags = codeYaml.tags ? codeYaml.tags : []
			const limit = codeYaml.limit ? codeYaml.limit : this.settings.limit
			const yamlAutoCut = codeYaml.autoCut != null ? codeYaml.autoCut : this.settings.autoCut
			const yamlDistanceLimit = codeYaml.distanceLimit != null ? codeYaml.distanceLimit : this.settings.distanceLimit
			const showPercentage = codeYaml.showPercentage ? codeYaml.showPercentage : this.settings.showPercentageOnCodeQuery
			

			this.vectorHelper.queryText(text, tags, limit,yamlDistanceLimit,yamlAutoCut)
				.then(similarFiles => {
					if (!similarFiles) {
						el.createEl('div', { text: "Match up: No file matches!", cls: "empty_match" })
						return
					}
					// listEl.createEl("h5",{text:"Suggestions",cls:"similar_head"})  
					const fileFromDatabase:WeaviateFile[] = similarFiles['data']['Get'][this.settings.weaviateClass]


					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					const currentFilePath = view?.file?.path
					const cleanFileList:WeaviateFile[] = fileFromDatabase.filter(item => currentFilePath && currentFilePath != item.path)

					if (cleanFileList.length === 0) {
						el.createEl('small', { text: "Match up: No file matches!", cls: "empty_match" })
					}

					const listEl = el.createEl('ul', { cls: "similar_list_parent" })
					cleanFileList.map(file => {
						
						const file_name = file.filename
						const file_similarity = this.convertToSimilarPercentage(file._additional.distance)
						
						const i = listEl.createEl("li")
						
						

						const itemElement = i.createEl("a", {
							"text": showPercentage? `${file_name} - ${file_similarity}`: `${file_name}`,
							"href": file.path
							})

						itemElement.addEventListener('click', (event: MouseEvent) => {
							this.focusFile(file.path)
						});

						itemElement.addEventListener('mouseenter',(event)=>{
							this.app.workspace.trigger("hover-link",{
								source: SUGGESTION_EXTENSION_ID,
								event:event,
								hoverParent: itemElement.parentElement,
								targetEl: itemElement,
								linktext: file.filename,
								sourcePath: file.path
							})
						})

					})

				})
		})
	}


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		console.log("save settings")
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
		);

	}
	// async activeBigView() {
	// 	const leaf = this.app.workspace.getLeaf("tab")
	// 	leaf.setViewState({ "type": GRAPH_VIEW_TYPE, active: true })
	// }

	focusFile(filePath: string, shouldSplit = false) {
		const targetFile = this.app.vault
			.getFiles()
			.find((f) => f.path === filePath)
		// const otherLeaf =  this.app.workspace.getLeaf('split');
		const currentLeaf = this.app.workspace.getMostRecentLeaf()

		if (targetFile) {
			currentLeaf?.openFile(targetFile, { active: true })
		}
	}

	async getCurrentQuery() {

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const isFile = view?.file?.path

		if (isFile) {
			const activeFile = this.app.workspace.getActiveFile()
			if (!activeFile) { return null }
			const query = await this.app.vault.cachedRead(activeFile)
			return query
		} else {
			return null
		}
	}

	convertToSimilarPercentage(cosine: number) {
		const percentage = ((50 * cosine) - 100) * -1;
		return percentage.toFixed(2) + "%";
	}


	async readFileWithPath(path: string) {
		const absFile = this.app.vault.getAbstractFileByPath(path)
		if(absFile){
			const file: TFile = absFile as TFile
			return this.app.vault.cachedRead(file)
		}else{
			return ""
		}
	}


	onunload() {
		
	}

}


interface Book {
	title: string;
	author: string;
}

const ALL_BOOKS = [
	{
		title: "How to Take Smart Notes",
		author: "Sönke Ahrens",
	},
	{
		title: "Thinking, Fast and Slow",
		author: "Daniel Kahneman",
	},
	{
		title: "Deep Work",
		author: "Cal Newport",
	},
];


export class ExampleModal extends SuggestModal<Book> {
	// Returns all available suggestions.
	getSuggestions(query: string): Book[] {
		return ALL_BOOKS.filter((book) =>
			book.title.toLowerCase().includes(query.toLowerCase())
		);
	}



	// Renders each suggestion item.
	renderSuggestion(book: Book, el: HTMLElement) {
		const c = this.inputEl.getText()
		if (c) {
			el.createEl("div", { text: c });
		} else {

			el.createEl("div", { text: book.title });
		}
		el.createEl("small", { text: book.author });
	}

	// Perform action on the selected suggestion.
	onChooseSuggestion(book: Book, evt: MouseEvent | KeyboardEvent) {
		new Notice(`Selected ${book.title}`);
	}
}



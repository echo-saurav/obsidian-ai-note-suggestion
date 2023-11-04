import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import MyPlugin from 'main';

export class MatchUpSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Weaviate Address')
			.setDesc('Enter your weaviate address ex: localhost:3636')
			.addText(text => text
				.setPlaceholder('ex: localhost:6636')
				.setValue(this.plugin.settings.weaviateAddress)
				.onChange(async (value) => {
					this.plugin.settings.weaviateAddress = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('Class')
		.setDesc('Weaviate class name')
		.addText(text => text
			.setPlaceholder('ex: Obsidian')
			.setValue(this.plugin.settings.weaviateClass)
			.onChange(async (value) => {
				this.plugin.settings.weaviateClass = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Suggestion Limit')
		.setDesc('Limit for how much result you want to see (max 30)')
		.addText(t => t
			.setPlaceholder("ex: 30")
			.setValue(`${this.plugin.settings.limit}`)
			.onChange(async (value) => {
				if(parseInt(value)>30){
					t.setValue("30")
				}else if (parseInt(value)<=0){
					t.setValue("1")
				}
				this.plugin.settings.limit = parseInt(value);
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Similarity Distance')
		.setDesc('Modify this if you want to set a similarity threshold, 2 is the lowest value (0 to disable). for more information check here \
		 https://weaviate.io/developers/weaviate/search/similarity#distance-threshold')
		.addText(t => t
			.setPlaceholder("ex: 70 ")
			.setValue(`${this.plugin.settings.distanceLimit}`)
			.onChange(async (value) => {
				let newval = value
				if(parseFloat(value)>2){
					t.setValue("2")
					newval=2
				}else if (parseFloat(value)<0){
					t.setValue("0")
					newval=0
				}
				this.plugin.settings.distanceLimit = parseFloat(newval);
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Enable Autocut')
		.setDesc('Leave it 0 to disable if you don\'t know what is it. For info check here https://weaviate.io/developers/weaviate/search/similarity#autocut ')
		.addText(t => t
			.setPlaceholder("ex: 1 ")
			.setValue(`${this.plugin.settings.autoCut}`)
			.onChange(async (value) => {
				if (parseInt(value)<0){
					t.setValue("0")
				}
				this.plugin.settings.autoCut = parseInt(value);
				await this.plugin.saveSettings();
			}));
		
		new Setting(containerEl)
		.setName('Show Percentage on query')
		.setDesc('Enable this if you want to get the match percentage info in code query')
		.addToggle(
			t=>t
			.setValue(this.plugin.settings.showPercentageOnCodeQuery)
			.onChange(async v=>{
				this.plugin.settings.showPercentageOnCodeQuery = v;
				await this.plugin.saveSettings();
		}))
		
		
		
		new Setting(containerEl)
		.setName('Show similar notes on top')
		.setDesc('If you enable this , plugin will show related notes on top of the current note')
		.addToggle(
			t=>t
			.setValue(this.plugin.settings.inDocMatchNotes)
			.onChange(async v=>{
				this.plugin.settings.inDocMatchNotes = v;
				await this.plugin.saveSettings();
		}))
		
		
	
		new Setting(containerEl)
		.setName('Re-build')
		.setDesc('Remove everything from weaviate and rebuild')
		.addButton(btn=> btn
			.setButtonText("Delete all")
			.onClick(()=>{
				new Notice("Removing everything from weaviate")
				this.plugin.vectorHelper.deleteAll()
			})
		)
	
	}
}

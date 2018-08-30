/**
 * `spriteful-cms-image-editor.js`
 * drag and drop image editor
 *
 *  properites:
 *
 *    target: name to save files for client app to reference 
 *            ie. 'home', 'shop', 'events', etc.
 *    
 *    type: used to set the path that the data is saved under
 *          so the client can refer to it
 *          also sets _mulitple for file selection (false for an image, true for carousel)
 *          ie. 'image' or 'carousel'
 *
 *
 *  methods:
 *
 *    init()  call when ready to fetch previous data
 *
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
import {
  SpritefulElement, 
  htmlTemplate
}                 from '@spriteful/spriteful-element/spriteful-element.js';
import {
  isDisplayed, 
  listen, 
  message, 
  schedule
}                 from '@spriteful/utils/utils.js';
import htmlString from './spriteful-cms-image-editor.html';
import services   from '@spriteful/services/services.js';
import '@spriteful/spriteful-cms-icons/spriteful-cms-icons.js';
import '@spriteful/spriteful-drag-drop-list/spriteful-drag-drop-list.js';
import '@spriteful/spriteful-drag-drop-files/spriteful-drag-drop-files.js';
import '@spriteful/spriteful-modal/spriteful-modal.js';
import '@spriteful/spriteful-spinner/spriteful-spinner.js';
import '@polymer/iron-image/iron-image.js';
import '@polymer/paper-button/paper-button.js';
import '@polymer/paper-input/paper-input.js';


const dropIsOverDeleteArea = ({top, right, bottom, left, x, y}) => {
  if (y < top || y > bottom) { return false; }
  if (x < left || x > right) { return false; }
  return true;
};


const getNewFileName = filename => filename.split('.')[0];


class SpritefulCmsImageEditor extends SpritefulElement {
  static get is() { return 'spriteful-cms-image-editor'; }

  static get template() {
    return htmlTemplate(htmlString);
  }


  static get properties() {
    return {
      // name to save files for client app to reference 
      // ie. 'home', 'shop', 'events', etc.
      target: String,
      // used to set the path that the data is saved under
      // so the client can refer to it
      // also sets _mulitple for file selection (false for an image, true for carousel)
      // ie. 'image' or 'carousel'
      type: String,
      // one file upload or multiple files
      _multiple: {
        type: Boolean,
        computed: '__computeMultiple(type)'
      },

      _directory: {
        type: String,
        computed: '__computeDirectory(_path, target)'
      },

      _filesToRename: Array,

      _items: {
        type: Array,
        value: () => ([])
      },

      _itemToDelete: Object,

      _itemsUploadData: {
        type: Object,
        value: () => ({})
      },

      _newFileNames: {
        type: Object,
        value: () => ({})
      },

      _publishChangesBtnDisabled: {
        type: Boolean,
        value: true
      },

      _targetToDelete: Object, 

      _path: {
        type: String,
        readOnly: true,
        computed: '__computePath(type)'
      }

    };
  }


  __computeMultiple(type) {
    return type === 'carousel';
  }


  __computePath(type) {
    return `cms/ui/${type}s`;
  }


  __computeDirectory(path, target) {
    if (!path || !target) { return; }
    return `${path}/${target}`;
  }


  async __fetchItemsFromDb() {
    try {
      const data = await services.get({coll: this._path, doc: this.target});

      if (!data) { 
        this._items = [];
        return;
      }

      this._items = data.images;
    }
    catch (error) {
      if (error.message) {
        const text = error.message.split('!')[0];
        if (text === 'Error: No such document') { return; } // ignore new instances
      }
      this.$.spinner.hide();
      console.error(error);
    }
  }


  __computeFileNamePlaceholder(fileName) {
    return fileName.split('.')[0];
  }


  __checkPublishChangesBtnState() {
    const files                     = this.$.fileDropZone.getFiles();
    this._publishChangesBtnDisabled = Boolean(files.length);
  }


  __handleFileSaved(event) {
    // data === {key, name, url, path}
    const {name}                    = event.detail;
    this._itemsUploadData[name]     = event.detail;
    this.__checkPublishChangesBtnState();
  }


  __handleImageLoadedChanged(event) {
    const {detail, model} = event;
    const {value: loaded} = detail;
    if (loaded) {
      window.URL.revokeObjectURL(model.item.url);
    }
  }


  __renameInputChanged(event) {
    const {value}            = event.detail;
    const {name}             = event.model.item;
    this._newFileNames[name] = value;
  }


  __addNewItems(files) {
    const newItems = files.map(file => ({
      name: file.newName,
      url:  file.tempUrl
    }));

    if (this.multiple) {
      this.push('_items', ...newItems);
    }
    else {
      this._items = newItems;
    }
  }


  async __saveFileNamesButtonClicked() {
    try {
      await this.clicked();
      const renamedFiles = this._filesToRename.map(file => {
        if (this._newFileNames[file.name]) {
          file.newName = this._newFileNames[file.name];
        }
        else {
          file.newName = getNewFileName(file.name);
        }
        return file;
      });
      this.__addNewItems(renamedFiles);
      this.$.fileDropZone.addFiles(renamedFiles);
      await schedule();
      this.__checkPublishChangesBtnState(); 
      await this.$.renameFilesModal.close();
      this._filesToRename = undefined;
      this._newFileNames  = {};
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __dismissRenameFilesModalButtonClicked() {
    try {
      await this.clicked();
      const files = this._filesToRename.map(file => {
        file.newName = getNewFileName(file.name);
        return file;
      });
      this.__addNewItems(files);
      this.$.fileDropZone.addFiles(files);
      await schedule();
      this.__checkPublishChangesBtnState(); 
      await this.$.renameFilesModal.close();
      this._filesToRename = undefined;
      this._newFileNames  = {};
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __handleFilesAdded(event) {
    const {files}       = event.detail;
    this._filesToRename = files.map(file => {
      file.tempUrl = window.URL.createObjectURL(file);
      return file;
    });
    await schedule();
    this.$.renameFilesModal.open();
  }


  async __handleFileRemoved(event) {
    try {
      await this.$.spinner.show(`Deleting ${this.type} item data...`);      
      const {name}   = event.detail;
      const elements = this.selectAll('.sortable');
      const element  = elements.find(element => element.item.name === name);
      if (!element) { return; }
      element.classList.remove('sortable');
      element.style.display = 'none';
      const previousPath    = element.item.path;
      const recentPath = 
        this._itemsUploadData[name] ? this._itemsUploadData[name].path : undefined;     
      delete this._itemsUploadData[name];

      if (previousPath) {
        await services.deleteFile(previousPath);
      }
      if (recentPath) {
        await services.deleteFile(previousPath);
      }
      await services.deleteField({coll: this._path, doc: this.target, field: name});
    }
    catch (error) {
      console.error(error);
    }
    finally {
      this.$.spinner.hide();
    }
  }


  __handleSortFinished() {
    if (this._itemToDelete) {
      this._targetToDelete.style.opacity = '0';
    }
    this.__checkPublishChangesBtnState(); 
  }

  // drag-drop delete area modal
  async __confirmDeleteButtonClicked() {
    try {
      await this.clicked();

      const files        = this.$.fileDropZone.getFiles();
      const fileToDelete = files.find(file => file.newName === this._itemToDelete.name);

      if (fileToDelete) { // cancel upload and remove file from dropzone list
        this.$.fileDropZone.removeFile(fileToDelete);
      }

      const {name, path} = this._itemToDelete;
      const getDeletePath = () => {
        if (path) {
          return path;
        }
        if (this._itemsUploadData[name]) {
          return this._itemsUploadData[name].path;
        }
      };

      const deletePath = getDeletePath();

      if (deletePath) {
        await this.$.spinner.show(`Deleting ${this.type} file...`);
        delete this._itemsUploadData[name];
        await services.deleteFile(deletePath);
        await services.deleteField({coll: this._path, doc: this.target, field: name});
      }
    }
    catch (error) {
      if (error === 'click disabled') { return; }
      console.error(error);
    }
    finally {
      const elements = this.selectAll('.sortable');
      const element  = elements.find(element => element.item.name === this._itemToDelete.name);
      element.classList.remove('sortable');
      element.style.display              = 'none';
      this._targetToDelete.style.opacity = '1';
      await this.$.deleteConfirmModal.close();
      this._targetToDelete = undefined;
      this._itemToDelete   = undefined;
      this.$.spinner.hide();
    }
  }


  async __dismissDeleteConfirmButtonClicked() {
    try {
      await this.clicked();
      this._targetToDelete.style.opacity = '1';
      this._itemToDelete                 = undefined;
      this.$.deleteConfirmModal.close();
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }
  // see if item was dropped over the delete area
  // compare pointer coordinates with area position
  async __handleDeleteDrop(event) {
    const {data, target}             = event.detail;
    const {x, y}                     = data;
    const {top, right, bottom, left} = this.$.deleteArea.getBoundingClientRect();
    const measurements               = {top, right, bottom, left, x, y};

    if (dropIsOverDeleteArea(measurements)) {
      // show a confirmation modal before deleting
      const {item}           = target;
      const {height, width}  = target.getBoundingClientRect();
      const xCenter          = x - (width / 2);
      const yCenter          = y - (height / 2);
      // override transform to keep item over delete zone
      target.style.transform = `translate3d(${xCenter}px, ${yCenter}px, 1px)`;
      this._targetToDelete   = target;
      this._itemToDelete     = item;
      await schedule();
      this.$.deleteConfirmModal.open();
    }
  }


  async __saveChangesButtonClicked() {
    try {
      await this.clicked();
      await this.$.spinner.show('Saving changes...');
      // build an object with upload data and the resorted index
      // based on how they show up in the drag and drop list
      const repeaterElements = this.selectAll('.sortable').
                                 filter(el => isDisplayed(el));
      const images = repeaterElements.map(element => {
        const {name} = element.item;
        return Object.assign(
          {capture: false, orientation: 0}, 
          element.item, 
          this._itemsUploadData[name]
        );
      });
      await services.set({coll: this._path, doc: this.target, data: {images}});
      this.$.fileDropZone.reset();
      this._items = [];
      await this.__fetchItemsFromDb();
      this._publishChangesBtnDisabled = true;
      await this.$.spinner.hide();
      message('Your changes are now live!');
    }
    catch (error) { 
      if (error === 'click debounced') { return; }
      console.error(error); 
    }
  }


  async init() {
    if (!this.target || !this.type)   { return; }
    if (this._items.length) { return; }

    await this.$.spinner.show(`Loading ${this.type} data...`);
    this.$.container.style.opacity = '1';
    await this.__fetchItemsFromDb();
    return this.$.spinner.hide();
  }

}

window.customElements.define(SpritefulCmsImageEditor.is, SpritefulCmsImageEditor);

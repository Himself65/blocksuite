import '@blocksuite/blocks';
import '@blocksuite/editor';
import { createEditor, createDebugMenu, BlockSchema } from '@blocksuite/editor';
import {
  DebugDocProvider,
  IndexedDBDocProvider,
  createWebsocketDocProvider,
  createAutoIncrementIdGenerator,
  uuidv4,
  Workspace,
} from '@blocksuite/store';
import type { DocProviderConstructor, StoreOptions } from '@blocksuite/store';
import './style.css';

const params = new URLSearchParams(location.search);
const room = params.get('room') ?? 'playground';
/**
 * With `?init` in url, an empty editor will be initialized automatically.
 * Without this option, only workspace will be initialized, the editor need to be loaded by clicking init button.
 */
const autoInit = params.get('init') !== null;

/**
 * Specified by `?syncModes=debug` or `?syncModes=indexeddb,debug`
 * Default is debug (using webrtc)
 */
function getEditorOptions(): Pick<StoreOptions, 'providers' | 'idGenerator'> {
  const providers: DocProviderConstructor[] = [];

  /**
   * Specified using "uuidv4" when providers have indexeddb.
   * Because when persistent data applied to ydoc, we need generator different id for block.
   * Otherwise, the block id will conflict.
   */
  let forceUUIDv4 = false;

  const modes = (params.get('syncModes') ?? 'debug').split(',');

  modes.forEach(mode => {
    switch (mode) {
      case 'debug':
        providers.push(DebugDocProvider);
        break;
      case 'indexeddb':
        providers.push(IndexedDBDocProvider);
        forceUUIDv4 = true;
        break;
      case 'websocket': {
        const WebsocketDocProvider = createWebsocketDocProvider(
          'ws://127.0.0.1:1234'
        );
        providers.push(WebsocketDocProvider);
        forceUUIDv4 = true;
        break;
      }
      default:
        throw new TypeError(
          `Unknown provider ("${mode}") supplied in search param ?syncModes=... (for example "debug" and "indexeddb")`
        );
    }
  });

  /**
   * Specified using "uuidv4" when providers have indexeddb.
   * Because when persistent data applied to ydoc, we need generator different id for block.
   * Otherwise, the block id will conflict.
   */
  const idGenerator = forceUUIDv4 ? uuidv4 : createAutoIncrementIdGenerator();

  return {
    providers,
    idGenerator,
  };
}

const workspace = new Workspace({
  room,
  ...getEditorOptions(),
});

const initButton = <HTMLButtonElement>document.getElementById('init-btn');

function initEmptyEditor() {
  // Init default workspace for manual local testing.
  const page = workspace
    .createPage<typeof BlockSchema>('page0')
    .register(BlockSchema);
  const editor = createEditor(page);
  const debugMenu = createDebugMenu(workspace, editor);

  document.body.appendChild(editor);
  document.body.appendChild(debugMenu);
  initButton.disabled = true;

  Object.defineProperties(globalThis ?? window, {
    workspace: {
      enumerable: true,
      configurable: true,
      writable: false,
      value: workspace,
    },
    blockSchema: {
      enumerable: true,
      configurable: true,
      writable: false,
      value: BlockSchema,
    },
    editor: {
      enumerable: true,
      configurable: true,
      writable: false,
      value: editor,
    },
    page: {
      enumerable: true,
      configurable: true,
      writable: false,
      value: page,
    },
  });
}

initButton.addEventListener('click', initEmptyEditor);

if (autoInit) {
  initEmptyEditor();
}

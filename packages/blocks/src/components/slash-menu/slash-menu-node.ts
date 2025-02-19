import { paragraphConfig } from '@blocksuite/global/config';
import type { BaseBlockModel } from '@blocksuite/store';
import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { updateSelectedTextType } from '../../page-block/utils/index.js';
import type { RichText } from '../../__internal__/rich-text/rich-text.js';
import {
  asyncFocusRichText,
  getRichTextByModel,
} from '../../__internal__/utils/index.js';

const styles = css`
  .overlay-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: var(--affine-z-index-popover);
  }

  .slash-menu-container {
    position: fixed;
    z-index: var(--affine-z-index-popover);
  }

  .slash-menu {
    font-size: var(--affine-font-sm);
    position: absolute;
    min-width: 173px;
    padding: 8px 4px;
    overflow-y: auto;

    background: var(--affine-popover-background);
    box-shadow: var(--affine-popover-shadow);
    border-radius: 0px 10px 10px 10px;
    z-index: var(--affine-z-index-popover);
  }
`;

@customElement('slash-menu')
export class SlashMenu extends LitElement {
  static styles = styles;

  @property()
  left: string | null = null;

  @property()
  top: string | null = null;

  @property()
  maxHeight: string | null = null;

  @property()
  position: 'top' | 'bottom' = 'bottom';

  @property()
  model!: BaseBlockModel;

  @property()
  abortController = new AbortController();

  @query('.slash-menu')
  slashMenuElement!: HTMLElement;

  @state()
  private _activeItemIndex = 0;

  @state()
  private _filterItems: typeof paragraphConfig = paragraphConfig;

  private _searchString = '';

  // Just a temp variable
  private _richText?: RichText;

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._escapeListener);

    const richText = getRichTextByModel(this.model);
    if (!richText) {
      console.warn(
        'Slash Menu may not work properly! No rich text found for model',
        this.model
      );
      return;
    }
    richText.addEventListener('keydown', this._keyDownListener, {
      // Workaround Use capture to prevent the event from triggering the keyboard bindings action
      capture: true,
    });
    this._richText = richText;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._escapeListener);
    this._richText?.removeEventListener('keydown', this._keyDownListener, {
      capture: true,
    });
  }

  /**
   * Handle arrow key
   */
  private _keyDownListener = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      this.abortController.abort();
      return;
    }
    if (e.key === 'Backspace') {
      if (!this._searchString.length) {
        this.abortController.abort();
      }
      this._searchString = this._searchString.slice(0, -1);
      this._filterItems = this._updateItem();
      return;
    }
    if (e.key.length === 1) {
      this._searchString += e.key;
      this._filterItems = this._updateItem();
      if (!this._filterItems.length) {
        this.abortController.abort();
      }
      return;
    }

    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(
        e.key
      )
    ) {
      return;
    }
    const configLen = this._filterItems.length;
    switch (e.key) {
      case 'Enter': {
        this._handleItemClick(this._activeItemIndex);
        break;
      }
      case 'ArrowUp': {
        this._activeItemIndex =
          (this._activeItemIndex - 1 + configLen) % configLen;
        break;
      }
      case 'ArrowDown': {
        this._activeItemIndex = (this._activeItemIndex + 1) % configLen;
        break;
      }
      case 'ArrowRight':
      case 'ArrowLeft':
        this.abortController.abort();
        return;
      default:
        throw new Error(`Unknown key: ${e.key}`);
    }
    // prevent arrow key from moving cursor
    e.preventDefault();
    // prevent the event from triggering the keyboard bindings action
    e.stopPropagation();
  };

  /**
   * Handle press esc
   */
  private _escapeListener = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') {
      return;
    }
    this.abortController.abort();
    window.removeEventListener('keyup', this._escapeListener);
  };

  private _handleItemClick(index: number) {
    // Need to remove the search string
    this.abortController.abort(this._searchString);
    const { flavour, type } = this._filterItems[index];

    if (this.model.page.awarenessStore.getFlag('enable_append_flavor_slash')) {
      // Add new block
      const page = this.model.page;
      const parent = page.getParent(this.model);
      if (!parent) {
        throw new Error('Failed add block!');
      }
      const index = parent.children.indexOf(this.model);
      const id = page.addBlockByFlavour(flavour, { type }, parent, index + 1);
      asyncFocusRichText(page, id);
      return;
    }
    updateSelectedTextType(flavour, type);
  }

  private _updateItem(): typeof paragraphConfig {
    this._activeItemIndex = 0;
    const searchStr = this._searchString.toLowerCase();
    if (!searchStr) {
      return paragraphConfig;
    }
    return paragraphConfig.filter(({ name }) => {
      if (
        name
          .trim()
          .toLowerCase()
          .split('')
          .filter(char => /[A-Za-z0-9]/.test(char))
          .join('')
          .includes(searchStr)
      ) {
        return true;
      }
      return false;
    });
  }

  override render() {
    const containerStyles = styleMap({
      left: this.left,
      top: this.top,
    });

    const slashMenuStyles = styleMap({
      top: this.position === 'bottom' ? '100%' : null,
      bottom: this.position !== 'bottom' ? '100%' : null,
      maxHeight: this.maxHeight,
    });

    return html`<div class="slash-menu-container" style="${containerStyles}">
      <div
        class="overlay-mask"
        @click="${() => this.abortController.abort()}"
      ></div>
      <div class="slash-menu" style="${slashMenuStyles}">
        ${this._filterItems.map(
          ({ type, name, icon }, index) => html`<format-bar-button
            width="100%"
            style="padding-left: 12px; justify-content: flex-start;"
            ?hover=${this._activeItemIndex === index}
            text="${name}"
            data-testid="${type}"
            @click=${() => {
              this._handleItemClick(index);
            }}
          >
            ${icon}
          </format-bar-button>`
        )}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-menu': SlashMenu;
  }
}

import { Schema } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import OrderedMap from 'orderedmap';

export enum DiffType {
  Inserted = 1,
  Deleted = -1,
}

const diffMarkSpec = {
  attrs: { type: { default: '' } },
  toDOM(mark: any) {
    let className = '';
    switch (mark.attrs.type) {
      case DiffType.Inserted:
        className = 'bg-green-100 text-green-700 dark:bg-green-500/70 dark:text-green-300';
        break;
      case DiffType.Deleted:
        className = 'bg-red-100 line-through text-red-600 dark:bg-red-500/70 dark:text-red-300';
        break;
      default:
        className = '';
    }
    return ['span', { class: className, 'data-diff': mark.attrs.type }, 0];
  },
};

const nodes = addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block');

const marks = OrderedMap.from({
  ...basicSchema.spec.marks.toObject(),
  diffMark: diffMarkSpec as any,
});

export const documentSchema = new Schema({ nodes, marks });

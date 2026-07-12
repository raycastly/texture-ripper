const UndoManager = {
    _undoStack: [],
    _redoStack: [],
    _maxSize: 100,
    _batch: null,
    beginBatch() { this._batch = []; },
    endBatch() {
        if (!this._batch) return;
        const actions = this._batch;
        this._batch = null;
        if (actions.length === 0) return;
        this.push({
            undo: () => { for (let i = actions.length - 1; i >= 0; i--) actions[i].undo(); },
            redo: () => { for (let i = 0; i < actions.length; i++) actions[i].redo(); }
        });
    },
    push(action) {
        if (this._batch) { this._batch.push(action); return; }
        this._undoStack.push(action);
        if (this._undoStack.length > this._maxSize) this._undoStack.shift();
        this._redoStack = [];
    },
    undo() {
        const action = this._undoStack.pop();
        if (!action) return false;
        action.undo();
        this._redoStack.push(action);
        return true;
    },
    redo() {
        const action = this._redoStack.pop();
        if (!action) return false;
        action.redo();
        this._undoStack.push(action);
        return true;
    },
    clear() { this._undoStack = []; this._redoStack = []; this._batch = null; },
    canUndo() { return this._undoStack.length > 0; },
    canRedo() { return this._redoStack.length > 0; }
};

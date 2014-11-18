// Copyright (c) Jonathan Frederic, see the LICENSE file for more info.

var utils = require('../utils.js');
var renderer = require('./renderer.js');

/**
 * Render the text rows of a DocumentModel.
 * @param {Canvas} canvas instance
 * @param {DocumentModel} model instance
 */
var RowRenderer = function(canvas, model) {
    renderer.RendererBase.call(this, canvas);
    this._model = model;
    this._row_heights = [];
    this._row_tops = [];

    // Set some basic rendering properties.
    this._base_options = {
        font_family: 'monospace',
        font_size: 12,
    };
    this._line_spacing = 2;

    this._model.on('tags_changed', utils.proxy(this._handle_value_changed, this));
    this._model.on('text_changed', utils.proxy(this._handle_value_changed, this));
    this._model.on('row_changed', utils.proxy(this._handle_row_changed, this)); // TODO: Implement my event.
};
utils.inherit(RowRenderer, renderer.RendererBase);

/**
 * Render to the canvas
 * Note: This method is called often, so it's important that it's
 * optimized for speed.
 * @return {null}
 */
RowRenderer.prototype.render = function() {

    // Find the row closest to the scroll top.  If that row is below
    // the scroll top, use the row above it.
    var closest = utils.find_closest(this._row_tops, this._canvas.scroll_top);
    if (this._row_tops[closest] > this._canvas.scroll_top) {
        closest = ((closest === 0) ? 0 : closest - 1);
    }

    // Render till there are no rows left, or the top of the row is
    // below the bottom of the visible area.
    for (var i = closest; 
        i < this._model._rows.length && 
        this._row_tops[i] < this._canvas.scroll_top + this._canvas.height; 
        i++) {        

        this._render_row(i);
    }
};

/**
 * Gets the row and character indicies closest to given control space coordinates.
 * @param  {float} cursor_x - x value, 0 is the left of the canvas.
 * @param  {float} cursor_y - y value, 0 is the top of the canvas.
 * @return {dictionary} dictionary of the form {row_index, char_index}
 */
RowRenderer.prototype.get_row_char = function(cursor_x, cursor_y) {
    
    // Find the row closest to the scroll top.  If that row is below
    // the scroll top, use the row above it.
    var closest = utils.find_closest(this._row_tops, cursor_y + this._canvas.scroll_top);
    if (this._row_tops[closest] > this._canvas.scroll_top) {
        closest = ((closest === 0) ? 0 : closest - 1);
    }

    // Find the character index.
    var widths = [0];
    try {
        for (var length=1; length<=this._model._rows[closest].length; length++) {
            widths.push(this.measure_partial_row_width(closest, length));
        }
    } catch (e) {
        // Nom nom nom...
    }
    return {row_index: closest, char_index: utils.find_closest(widths, cursor_x + this._canvas.scroll_left)};
};

/**
 * Measures the partial width of a text row.
 * @param  {integer} index
 * @param  {integer} (optional) length - number of characters
 * @return {float} width
 */
RowRenderer.prototype.measure_partial_row_width = function(index, length) {
    return this._canvas.measure_text(this._model._rows[index].substring(0, length || this._model._rows[index].length), this._base_options);
};

/**
 * Get the top of a row
 * @param  {integer} index 
 * @return {float} top
 */
RowRenderer.prototype.get_row_top = function(index) {
    return this._row_tops[index];
};

/**
 * Get the height of a row
 * @param  {integer} index 
 * @return {float} height
 */
RowRenderer.prototype.get_row_height = function(index) {
    return this._row_heights[index];
};

/**
 * Handles when the model's value changes
 * Complexity: O(N) for N rows of text.
 * @return {null}
 */
RowRenderer.prototype._handle_value_changed = function() {

    // Calculate the document height and width while constructing
    // a running list of start heights for rows.
    utils.clear_array(this._row_heights);
    utils.clear_array(this._row_tops);
    var document_width = 0;
    var document_height = 0;
    for (var i=0; i<this._model._rows.length; i++) {
        document_width = Math.max(this._measure_row_width(i), document_width);

        this._row_tops.push(document_height);
        var height = this._measure_row_height(i);
        document_height += height;
        this._row_heights.push(height);
    }
    this._canvas.scroll_width = document_width;
    this._canvas.scroll_height = document_height;
};

/**
 * Handles when one of the model's rows change
 * @return {null}
 */
RowRenderer.prototype._handle_row_changed = function(index) {
    this._canvas.scroll_width = Math.max(this._measure_row_width(index), this._canvas.scroll_width);

    // If the row height has changed, update all of the rows below 
    // that row.  Otherwise, do nothing.
    var height = this._measure_row_height(index);
    if (this._row_heights[index] !== height) {
        var document_height = this._row_tops[index];

        // Shallow copy the row information up to this point.  Allow
        // the GC to collect the original array when it's ready.
        this._row_tops = this._row_tops.slice(0, index);
        this._row_heights = this._row_heights.slice(0, index);

        for (var i=index; i<this._model._rows.length; i++) {
            this._row_tops.push(document_height);
            height = this._measure_row_height(i);
            document_height += height;
            this._row_heights.push(height);
        }
        this._canvas.scroll_height = document_height;
    }
};

/**
 * Render a single row
 * @param  {integer} index
 * @return {null}
 */
RowRenderer.prototype._render_row = function(index) {
    this._canvas.draw_text(0, this._row_tops[index], this._model._rows[index], this._base_options);
};

/**
 * Measures the width of a text row as if it were rendered.
 * @param  {integer} index
 * @return {float} width
 */
RowRenderer.prototype._measure_row_width = function(index) {
    return this.measure_partial_row_width(index, this._model._rows[index].length);
};

/**
 * Measures the height of a text row as if it were rendered.
 * @param  {integer} index
 * @return {float} height
 */
RowRenderer.prototype._measure_row_height = function(index) {
    return this._line_spacing + this._base_options.font_size;
};

// Exports
exports.RowRenderer = RowRenderer;

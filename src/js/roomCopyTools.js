(function () {
    const gui = require('nw.gui');
    const clickThreshold = 16;

    const drawInsertPreview = function(e) {
        let img, graph, w, h, grax, gray, ox, oy;
        // превью вставки
        this.refreshRoomCanvas(e);
        this.refs.canvas.x.setTransform(this.zoomFactor, 0, 0, this.zoomFactor, 0, 0);
        this.refs.canvas.x.globalAlpha = 0.5;
        if (this.currentType.graph !== -1) {
            img = window.glob.graphmap[this.currentType.graph];
            graph = img.g;
            ox = graph.offx;
            oy = graph.offy;
            w = graph.width;
            h = graph.height;
            [grax, gray] = graph.axis;
        } else {
            img = window.glob.graphmap[-1];
            w = h = 32;
            ox = oy = 0;
            grax = gray = 16;
        }
        if (this.room.gridX === 0 || e.altKey) {
            this.refs.canvas.x.drawImage(
                img,
                ox, oy, w, h,
                e.offsetX / this.zoomFactor - grax, e.offsetY / this.zoomFactor - gray, w, h);
        } else {
            // если есть сетка, то координаты предварительной копии нужно отснэпить по сетке
            var dx = this.xToRoom(e.offsetX),
                dy = this.yToRoom(e.offsetY);
            w = graph.width;
            h = graph.height;
            this.refs.canvas.x.drawImage(
                img, ox, oy, w, h,
                this.xToCanvas(Math.round(dx / this.room.gridX) * this.room.gridX) / this.zoomFactor - grax,
                this.yToCanvas(Math.round(dy / this.room.gridY) * this.room.gridY) / this.zoomFactor - gray,
                w, h);
        }
    };
    const selectACopyAt = function (e) {
        var pos = 0,
            length = Infinity,
            l,
            fromx = this.xToRoom(e.offsetX),
            fromy = this.yToRoom(e.offsetY);
        const layerCopies = this.room.copies;
        for (let j = 0, lj = layerCopies.length; j < lj; j++) {
            const xp = layerCopies[j].x - fromx,
                yp = layerCopies[j].y - fromy;
            l = Math.sqrt(xp * xp + yp * yp);
            if (l < length) {
                length = l;
                pos = j;
            }
        }
        return this.room.copies[pos];
    };

    /* global glob */
    window.roomCopyTools = {
        init() {
            this.currentType = -1;
            this.onCanvasPressCopies = e => {
                if (this.selectedCopies && !e.shiftKey) {
                    for (const copy of this.selectedCopies) {
                        var x = this.xToRoom(this.startx),
                            y = this.yToRoom(this.starty);
                        const {g} = glob.graphmap[window.currentProject.types[glob.typemap[copy.uid]].graph];
                        if (x > copy.x - g.axis[0] && y > copy.y - g.axis[1] &&
                            x < copy.x - g.axis[0] + g.width && y < copy.y - g.axis[1] + g.height) {
                            this.movingStuff = true;
                            for (const copy of this.selectedCopies) {
                                copy.lastX = copy.x;
                                copy.lastY = copy.y;
                            }
                            return true;
                        }
                    }
                }
                return false;
            };
            this.onCanvasMouseUpCopies = e => {
                if (e.button === 0 && this.currentType === -1 && e.shiftKey) {
                    if (Math.hypot(e.offsetX - this.startx, e.offsetY - this.starty) > clickThreshold) {
                        // Было прямоугольное выделение
                        if (!this.selectedCopies) {
                            this.selectedCopies = [];
                        }
                        var x1 = this.xToRoom(this.startx),
                            y1 = this.yToRoom(this.starty),
                            x2 = this.xToRoom(e.offsetX),
                            y2 = this.yToRoom(e.offsetY),
                            xmin = Math.min(x1, x2),
                            xmax = Math.max(x1, x2),
                            ymin = Math.min(y1, y2),
                            ymax = Math.max(y1, y2);
                        for (const copy of this.room.copies) {
                            const {g} = glob.graphmap[window.currentProject.types[glob.typemap[copy.uid]].graph];
                            if (copy.x - g.axis[0] > xmin && copy.x - g.axis[0] + g.width < xmax &&
                                copy.y - g.axis[1] > ymin && copy.y - g.axis[1] + g.height < ymax) {
                                const ind = this.selectedCopies.indexOf(copy);
                                if (ind === -1) {
                                    this.selectedCopies.push(copy);
                                }
                            }
                        }
                    } else {
                        // Был единичный выбор
                        if (!this.room.copies.length) { return; }
                        const copy = selectACopyAt.apply(this, [e]);
                        if (this.selectedCopies) {
                            const ind = this.selectedCopies.indexOf(copy);
                            if (ind !== -1) {
                                this.selectedCopies.splice(ind, 1);
                            } else {
                                this.selectedCopies.push(copy);
                            }
                        } else {
                            this.selectedCopies = [copy];
                        }
                    }
                } else if (this.movingStuff) {
                    for (const copy of this.selectedCopies) {
                        delete copy.lastX;
                        delete copy.lastY;
                    }
                }
                this.refreshRoomCanvas();
            };
            // При клике на канвас помещает копию на соответствующий слой
            this.onCanvasClickCopies = e => {
                // Отмена выделения копий, если таковые были, при клике
                if (this.selectedCopies && !this.movingStuff && !(e.shiftKey && this.currentType === -1)) {
                    this.selectedCopies = false;
                    this.refreshRoomCanvas();
                    return;
                }
                // Если не выбран тип создаваемой копии, или идёт удаление копий, то ничего не делаем
                if ((this.currentType === -1 || e.ctrlKey) && e.button === 0) {
                    return;
                }
                if (Number(this.room.gridX) === 0 || e.altKey) {
                    if (this.lastCopyX !== Math.floor(this.xToRoom(e.offsetX)) ||
                        this.lastCopyY !== Math.floor(this.yToRoom(e.offsetY))
                    ) {
                        this.lastCopyX = Math.floor(this.xToRoom(e.offsetX));
                        this.lastCopyY = Math.floor(this.yToRoom(e.offsetY));
                        this.room.copies.push({
                            x: this.lastCopyX,
                            y: this.lastCopyY,
                            uid: this.currentType.uid
                        });
                        this.resortRoom();
                        this.refreshRoomCanvas();
                    }
                } else {
                    var x = Math.floor(this.xToRoom(e.offsetX)),
                        y = Math.floor(this.yToRoom(e.offsetY));
                    if (this.lastCopyX !== Math.round(x / this.room.gridX) * this.room.gridX ||
                        this.lastCopyY !== Math.round(y / this.room.gridY) * this.room.gridY
                    ) {
                        this.lastCopyX = Math.round(x / this.room.gridX) * this.room.gridX;
                        this.lastCopyY = Math.round(y / this.room.gridY) * this.room.gridY;
                        this.room.copies.push({
                            x: this.lastCopyX,
                            y: this.lastCopyY,
                            uid: this.currentType.uid
                        });
                        this.resortRoom();
                        this.refreshRoomCanvas();
                    }
                }
            };
            /* eslint max-depth: 0 */
            this.onCanvasMoveCopies = e => {
                if (e.ctrlKey) {
                    if (this.mouseDown && this.room.copies.length !== 0) {
                        var l,
                            fromx = this.xToRoom(e.offsetX),
                            fromy = this.yToRoom(e.offsetY);
                        var maxdist = Math.max(this.room.gridX, this.room.gridY);
                        for (let j = 0, lj = this.room.copies.length; j < lj; j++) {
                            const xp = this.room.copies[j].x - fromx,
                                  yp = this.room.copies[j].y - fromy;
                            l = Math.sqrt(xp * xp + yp * yp);
                            if (l < maxdist) {
                                this.room.copies.splice(j, 1);
                                this.resortRoom();
                                break;
                            }
                        }
                    }
                    this.drawDeleteCircle(e);
                } else if (this.mouseDown && e.shiftKey) {
                    if (Math.hypot(e.offsetX - this.startx, e.offsetY - this.starty) > clickThreshold) {
                        this.refreshRoomCanvas(e);
                        // рисовка прямоугольного выделения
                        const x1 = this.xToRoom(this.startx),
                            x2 = this.xToRoom(e.offsetX),
                            y1 = this.yToRoom(this.starty),
                            y2 = this.yToRoom(e.offsetY);
                        this.drawSelection(x1, y1, x2, y2);
                    } 
                } else if (this.movingStuff) {
                    let dx = this.xToRoom(e.offsetX) - this.xToRoom(this.startx),
                        dy = this.yToRoom(e.offsetY) - this.yToRoom(this.starty);
                    if (!e.altKey && this.room.gridX && this.room.gridY) {
                        dx = Math.round(dx / this.room.gridX) * this.room.gridX;
                        dy = Math.round(dy / this.room.gridY) * this.room.gridY;
                    }
                    for (const copy of this.selectedCopies) {
                        copy.x = copy.lastX + dx;
                        copy.y = copy.lastY + dy;
                    }
                    this.refreshRoomCanvas(e);
                } else if (this.currentType !== -1) {
                    drawInsertPreview.apply(this, [e]);
                } else if (this.mouseDown && e.shift && Math.hypot(e.offsetX - this.startx, e.offsetY - this.starty) > clickThreshold) {
                    this.refreshRoomCanvas(e);
                    // рисовка прямоугольного выделения
                    const x1 = this.xToRoom(this.startx),
                          x2 = this.xToRoom(e.offsetX),
                          y1 = this.yToRoom(this.starty),
                          y2 = this.yToRoom(e.offsetY);
                    this.drawSelection(x1, y1, x2, y2);
                }
            };
            this.onCanvasContextMenuCopies = e => {
                // Сначала ищется ближайшая к курсору копия. Если слоёв в комнате нет, то всё отменяется
                if (!this.room.copies.length) { return; }
                var copy = selectACopyAt.apply(this, [e]),
                    type = window.currentProject.types[glob.typemap[copy.uid]],
                    graph = glob.graphmap[type.graph].g;
                this.closestType = type;
                this.closestPos = this.room.copies.indexOf(copy);

                // рисовка выделения копии
                this.refreshRoomCanvas();
                var left, top, height, width;
                if (type.graph !== -1) {
                    left = copy.x - graph.axis[0] - 1.5;
                    top = copy.y - graph.axis[1] - 1.5;
                    width = graph.width * (copy.tx || 1) + 3;
                    height = graph.height * (copy.ty || 1) + 3;
                } else {
                    left = copy.x - 16 - 1.5;
                    top = copy.y - 16 - 1.5;
                    height = 32 + 3;
                    width = 32 + 3;
                }
                this.drawSelection(left, top, left + width, top + height);

                this.forbidDrawing = true;
                setTimeout(() => {
                    this.forbidDrawing = false;
                }, 500);
                this.roomCanvasMenu.items[0].label = window.languageJSON.roomview.deletecopy.replace('{0}', type.name);
                this.roomCanvasMenu.popup(e.clientX, e.clientY);
            };

            this.roomCanvasCopiesMenu = new gui.Menu();
            this.roomCanvasCopiesMenu.append(new gui.MenuItem({
                label: window.languageJSON.roomview.deleteCopies,
                click: () => {
                    for (const copy of this.selectedCopies) {
                        this.room.copies.splice(this.room.copies.indexOf(copy), 1);
                    }
                    this.selectedCopies = false;
                    this.resortRoom();
                    this.refreshRoomCanvas();
                },
                key: 'Delete'
            }));
            this.roomCanvasCopiesMenu.append(new gui.MenuItem({
                label: window.languageJSON.roomview.shiftCopies,
                click: () => {
                    window.alertify.confirm(`
                        ${window.languageJSON.roomview.shiftCopies}
                        <label class="block">X: 
                            <input id="copiespositionx" type="number" value="${this.room.gridX}" />
                        </label>
                        <label class="block">Y: 
                            <input id="copiespositiony" type="number" value="${this.room.gridY}" />
                        </label>
                    `)
                        .then(e => {
                            if (e.buttonClicked === 'ok') {
                                var x = Number(document.getElementById('copiespositionx').value) || 0,
                                    y = Number(document.getElementById('copiespositiony').value) || 0;
                                for (const copy of this.selectedCopies) {
                                    copy.x += x;
                                    copy.y += y;
                                }
                                this.refreshRoomCanvas();
                            }
                        });
                }
            }));
            this.onCanvasContextMenuMultipleCopies = e => {
                this.forbidDrawing = true;
                setTimeout(() => {
                    this.forbidDrawing = false;
                }, 500);
                this.roomCanvasCopiesMenu.popup(e.clientX, e.clientY);
                e.preventDefault();
            };

            // Контекстное меню по нажатию на холст
            this.roomCanvasMenu = new gui.Menu();
            this.roomCanvasMenu.append(new gui.MenuItem({
                label: window.languageJSON.roomview.deletecopy.replace('{0}', this.closestType),
                click: () => {
                    this.room.copies.splice(this.closestPos, 1);
                    this.resortRoom();
                    this.refreshRoomCanvas();
                },
                key: 'Delete'
            }));
            this.roomCanvasMenu.append(new gui.MenuItem({
                label: window.languageJSON.roomview.changecopyscale,
                click: () => {
                    var copy = this.room.copies[this.closestPos];
                    window.alertify.confirm(`
                        ${window.languageJSON.roomview.changecopyscale}
                        <label class="block">X: 
                            <input id="copyscalex" type="number" value="${copy.tx || 1}" />
                        </label>
                        <label class="block">Y: 
                            <input id="copyscaley" type="number" value="${copy.ty || 1}" />
                        </label>
                    `)
                        .then(e => {
                            if (e.buttonClicked === 'ok') {
                                copy.tx = Number(document.getElementById('copyscalex').value) || 1;
                                copy.ty = Number(document.getElementById('copyscaley').value) || 1;
                                this.refreshRoomCanvas();
                            }
                        });
                }
            }));
            this.roomCanvasMenu.append(new gui.MenuItem({
                label: window.languageJSON.roomview.shiftcopy,
                click: () => {
                    var copy = this.room.copies[this.closestPos];
                    window.alertify.confirm(`
                        ${window.languageJSON.roomview.shiftcopy}
                        <label class="block">X: 
                            <input id="copypositionx" type="number" value="${copy.x}" />
                        </label>
                        <label class="block">Y: 
                            <input id="copypositiony" type="number" value="${copy.y}" />
                        </label>
                    `)
                        .then(e => {
                            if (e.buttonClicked === 'ok') {
                                copy.x = Number(document.getElementById('copypositionx').value) || 0;
                                copy.y = Number(document.getElementById('copypositiony').value) || 0;
                                this.refreshRoomCanvas();
                            }
                        });
                }
            }));
        }
    };
})();

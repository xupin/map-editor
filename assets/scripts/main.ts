import { grid, GRID_TYPE } from "./grid";

const { ccclass, property } = cc._decorator;

// 编辑器模式
enum EDITOR_MODE {
    VIEW = 0,
    EDIT,
}

@ccclass
export default class main extends cc.Component {

    @property(cc.Node)
    mapNode: cc.Node;

    @property(cc.ScrollView)
    mapScroll: cc.ScrollView;

    @property(cc.Graphics)
    mapGraphics: cc.Graphics;

    @property(cc.Node)
    brushNode: cc.Node;

    @property(cc.Button)
    viewBtn: cc.Button;

    @property(cc.Button)
    editBtn: cc.Button;

    @property(cc.Button)
    exportBtn: cc.Button;

    // 地图原始尺寸
    originWidth: number = 2862;
    originHeight: number = 2304;

    // 网格原始大小
    originGridWidth: number = 40;
    originGridHeight: number = 40;

    // 网格大小
    gridWidth: number = 40;
    gridHeight: number = 40;

    // 网格信息
    grids: Array<Array<grid>>;

    // 编辑模式
    mode: EDITOR_MODE = EDITOR_MODE.VIEW;

    // 刷子
    brush: GRID_TYPE = GRID_TYPE.OBSTACLE;

    // 地图缩放
    mapScale: number = 1.00;

    // 坐标信息
    @property(cc.Label)
    pixelLoc: cc.Label;

    @property(cc.Label)
    localLoc: cc.Label;

    @property(cc.Label)
    scale: cc.Label;

    xMax: number;
    yMax: number;

    start() {
        this.mapScroll.node.off(cc.Node.EventType.MOUSE_WHEEL);
    }

    onLoad() {
        // init logic
        cc.resources.load("textures/4006", cc.SpriteFrame, (err, frame: cc.SpriteFrame) => {
            if (err) {
                console.error(err.message || err);
                return;
            }
            this.mapNode.getComponent(cc.Sprite).spriteFrame = frame;
        });
        // map default size
        this.mapNode.width = this.originWidth;
        this.mapNode.height = this.originHeight;
        // graphics
        this.drawGrid(true);
        // mouse event
        this.mapNode.on(cc.Node.EventType.TOUCH_START, this.updateGrid, this);
        this.mapNode.on(cc.Node.EventType.TOUCH_MOVE, this.updateGrid, this);
        this.mapNode.on(cc.Node.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
        this.mapNode.on(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        // btn click
        this.viewBtn!.node.on("click", this.onView, this);
        this.editBtn!.node.on("click", this.onEdit, this);
        if (cc.sys.isBrowser) {
            this.exportBtn!.node.on("click", this.onExport, this);
        } else {
            this.exportBtn!.node.active = false;
        }
        this.onView();
    }

    // 拖动
    onView() {
        this.openScroll();
        cc.game.canvas.style.cursor = "pointer";
        this.mode = EDITOR_MODE.VIEW;
    }

    // 编辑
    onEdit() {
        this.closeScroll();
        cc.game.canvas.style.cursor = "crosshair";
        this.mode = EDITOR_MODE.EDIT;
    }

    // 滚动
    onMouseWheel(e: cc.Event.EventMouse) {
        const y: number = Number(e.getScrollY().toFixed(2));
        // 向上/向下
        if (y > 0) {
            if (this.mapScale > 1.25) {
                return;
            }
            this.mapScale += 0.25;
        } else {
            if (this.mapScale < 0.75) {
                return;
            }
            this.mapScale -= 0.25;
        }
        // 改变地图&网格尺寸
        this.mapNode.width = this.originWidth * this.mapScale;
        this.mapNode.height = this.originHeight * this.mapScale;
        this.gridWidth = this.originGridWidth * this.mapScale;
        this.gridHeight = this.originGridHeight * this.mapScale;
        // 显示缩放比例
        this.scale.string = String(this.mapScale * 100) + "%"
        // repaint
        this.drawGrid(false);
    }

    // 鼠标移动
    onMouseMove(e: cc.Event.EventMouse) {
        const eventPos: cc.Vec2 = e.getLocation();
        let x: number = Number(eventPos.x.toFixed(0));
        let y: number = Number(eventPos.y.toFixed(0));
        this.pixelLoc.string = `像素坐标${x},${y}`

        let pos: cc.Vec2 = this.mapNode.convertToNodeSpaceAR(eventPos);
        x = Math.floor(pos.x / this.gridWidth);
        y = Math.floor(pos.y / this.gridHeight);
        this.localLoc.string = `本地坐标${x},${y}`;
    }

    // 导出结果
    onExport() {
        let data: Array<Array<number>> = new Array(this.grids.length);
        for (let x: number = 0; x < this.grids.length; x++) {
            data[x] = new Array(this.grids[x].length);
            for (let y: number = 0; y < this.grids[x].length; y++) {
                data[x][y] = this.grids[x][y].type;
            }
        }
        const v: object = {
            map: {
                originWidth: this.originWidth,
                originHeight: this.originHeight,
                width: this.mapNode.width,
                height: this.mapNode.height,
            },
            grid: {
                width: this.gridWidth,
                height: this.gridHeight,
            },
            data: data,
        };
        let json = JSON.stringify(v)
        let blob = new Blob([json], { type: 'application/json' });
        let a = document.createElement("a");
        a.download = 'map.json';
        if (window.webkitURL != null) {
            a.href = window.webkitURL.createObjectURL(blob);
        }
        a.click();
    }

    // 更新格子
    updateGrid(event: cc.Touch) {
        if (this.mode != EDITOR_MODE.EDIT) {
            return;
        }
        const eventPos: cc.Vec2 = event.getLocation();
        let pos: cc.Vec2 = this.mapNode.convertToNodeSpaceAR(eventPos);
        let x: number = Math.floor(pos.x / this.gridWidth);
        let y: number = Math.floor(pos.y / this.gridHeight);
        let grid = this.getGrid(x, y);
        if (!grid) {
            console.error("grid不存在", x, y);
            return;
        }
        if (this.brush != GRID_TYPE.NORMAL && !grid.isNormal()) {
            return;
        }
        // 计算当前格子大小
        let size: [number, number] = this.getGridSize(x, y);
        // 填充
        grid.type = this.brush;
        if (this.brush != GRID_TYPE.NORMAL) {
            this.mapGraphics.rect(x * this.gridWidth, y * this.gridHeight, size[0], size[1]);
            this.mapGraphics.fillColor = grid.isObstacle() ? cc.Color.BLACK : cc.Color.BLUE;
            this.mapGraphics.fill();
        } else {
            this.drawGrid(false);
        }
    }

    // 关闭滚动
    closeScroll() {
        const scroll: any = this.mapScroll;
        scroll.node.off(cc.Node.EventType.TOUCH_START, scroll._onTouchBegan, scroll, true);
        scroll.node.off(cc.Node.EventType.TOUCH_MOVE, scroll._onTouchMoved, scroll, true);
        scroll.node.off(cc.Node.EventType.TOUCH_END, scroll._onTouchEnded, scroll, true);
        scroll.node.off(cc.Node.EventType.TOUCH_CANCEL, scroll._onTouchCancelled, scroll, true);
    }

    // 开启滚动
    openScroll() {
        const scroll: any = this.mapScroll;
        scroll.node.on(cc.Node.EventType.TOUCH_START, scroll._onTouchBegan, scroll, true);
        scroll.node.on(cc.Node.EventType.TOUCH_MOVE, scroll._onTouchMoved, scroll, true);
        scroll.node.on(cc.Node.EventType.TOUCH_END, scroll._onTouchEnded, scroll, true);
        scroll.node.on(cc.Node.EventType.TOUCH_CANCEL, scroll._onTouchCancelled, scroll, true);
    }

    // 刷子选中
    onBrushSelect(event: cc.Event, customEventData: string) {
        switch (customEventData) {
            case "obstacle":
                this.brush = GRID_TYPE.OBSTACLE;
                return;
            case "road":
                this.brush = GRID_TYPE.ROAD;
                return;
            case "clear":
                this.brush = GRID_TYPE.NORMAL;
                return;
        }
    }

    // 填充网格
    fillGrid() {
        for (let x: number = 0; x < this.grids.length; x++) {
            for (let y: number = 0; y < this.grids[x].length; y++) {
                let grid = this.getGrid(x, y);
                if (grid.isNormal()) {
                    continue;
                }
                // 计算当前格子大小
                let size: [number, number] = this.getGridSize(x, y);
                // 填充
                this.mapGraphics.rect(x * this.gridWidth, y * this.gridHeight, size[0], size[1]);
                this.mapGraphics.fillColor = grid.isObstacle() ? cc.Color.BLACK : cc.Color.BLUE;
                this.mapGraphics.fill();
            }
        }
    }

    // 画网格
    drawGrid(init: boolean) {
        this.mapGraphics.clear();
        this.mapGraphics.strokeColor = cc.Color.WHITE;
        this.mapGraphics.lineWidth = 2;
        // 画竖线
        let xMax: number = Math.ceil(this.mapNode.width / this.gridWidth)
        for (let i: number = 0; i < xMax; i++) {
            let x = i * this.gridWidth;
            this.mapGraphics.moveTo(x, 0)
            this.mapGraphics.lineTo(x, this.mapNode.height);
        }
        // 画横线
        let yMax: number = Math.ceil(this.mapNode.height / this.gridHeight)
        for (let i: number = 0; i < yMax; i++) {
            let y = i * this.gridHeight;
            this.mapGraphics.moveTo(0, y)
            this.mapGraphics.lineTo(this.mapNode.width, y);
        }
        this.mapGraphics.stroke();
        this.xMax = xMax - 1;
        this.yMax = yMax - 1;
        if (init) {
            // 记录格子信息
            this.grids = new Array(xMax);
            for (let i: number = 0; i < xMax; i++) {
                this.grids[i] = new Array(yMax);
                for (let j: number = 0; j < yMax; j++) {
                    this.grids[i][j] = new grid(i, j, GRID_TYPE.NORMAL);
                }
            }
        } else {
            this.fillGrid();
        }
    }

    // 获取网格大小
    getGridSize(x: number, y: number): [number, number] {
        let width: number = this.gridWidth;
        let height: number = this.gridHeight;
        if (x >= this.xMax) {
            width = this.gridWidth - ((this.xMax + 1) * this.gridWidth - this.mapNode.width);
        }
        if (y >= this.yMax) {
            height = this.gridHeight - ((this.yMax + 1) * this.gridHeight - this.mapNode.height);
        }
        width -= width * 0.05;
        height -= height * 0.05;
        return [width, height];
    }

    // 获取网格
    getGrid(x: number, y: number): grid {
        return this.grids[x][y];
    }
}

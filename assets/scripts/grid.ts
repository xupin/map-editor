// 格子类型
export enum GRID_TYPE {
    NORMAL, // 正常
    ROAD, // 路点
    OBSTACLE, // 障碍物
}

export class grid {
    type: number;
    x: number;
    y: number;

    public constructor(x: number, y: number, type: number) {
        this.x = x;
        this.y = y;
        this.type = type;
    }

    public isNormal(): boolean {
        return this.type == GRID_TYPE.NORMAL;
    }

    public isRoad(): boolean {
        return this.type == GRID_TYPE.ROAD;
    }

    public isObstacle(): boolean {
        return this.type == GRID_TYPE.OBSTACLE;
    }
}
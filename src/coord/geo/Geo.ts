/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

import * as zrUtil from 'zrender/src/core/util';
import BoundingRect from 'zrender/src/core/BoundingRect';
import View from '../View';
import geoSourceManager from './geoSourceManager';
import Region from './Region';
import { NameMap } from './geoTypes';
import GlobalModel from '../../model/Global';
import { ParsedModelFinder } from '../../util/model';
import GeoModel from './GeoModel';
import { resizeGeoType } from './geoCreator';


class Geo extends View {

    dimensions = ['lng', 'lat'];

    type = 'geo';

    // map type
    readonly map: string;

    private _nameCoordMap: zrUtil.HashMap<number[]>;
    private _regionsMap: zrUtil.HashMap<Region>;
    private _invertLongitute: boolean;
    readonly regions: Region[];

    // Injected outside
    aspectScale: number;
    model: GeoModel;
    resize: resizeGeoType;

    /**
     * For backward compatibility, the orginal interface:
     * `name, map, geoJson, specialAreas, nameMap` is kept.
     *
     * @param map Map type Specify the positioned areas by left, top, width, height.
     * @param [nameMap] Specify name alias
     */
    constructor(name: string, map: string, nameMap?: NameMap, invertLongitute?: boolean) {
        super(name);

        this.map = map;

        var source = geoSourceManager.load(map, nameMap);

        this._nameCoordMap = source.nameCoordMap;
        this._regionsMap = source.regionsMap;
        this._invertLongitute = invertLongitute == null ? true : invertLongitute;
        this.regions = source.regions;
        this._rect = source.boundingRect;
    }

    /**
     * Whether contain the given [lng, lat] coord.
     */
    containCoord(coord: number[]) {
        var regions = this.regions;
        for (var i = 0; i < regions.length; i++) {
            if (regions[i].contain(coord)) {
                return true;
            }
        }
        return false;
    }

    transformTo(x: number, y: number, width: number, height: number): void {
        var rect = this.getBoundingRect();
        var invertLongitute = this._invertLongitute;

        rect = rect.clone();

        if (invertLongitute) {
            // Longitute is inverted
            rect.y = -rect.y - rect.height;
        }

        var rawTransformable = this._rawTransformable;

        rawTransformable.transform = rect.calculateTransform(
            new BoundingRect(x, y, width, height)
        );

        rawTransformable.decomposeTransform();

        if (invertLongitute) {
            var scale = rawTransformable.scale;
            scale[1] = -scale[1];
        }

        rawTransformable.updateTransform();

        this._updateTransform();
    }

    getRegion(name: string): Region {
        return this._regionsMap.get(name);
    }

    getRegionByCoord(coord: number[]): Region {
        var regions = this.regions;
        for (var i = 0; i < regions.length; i++) {
            if (regions[i].contain(coord)) {
                return regions[i];
            }
        }
    }

    /**
     * Add geoCoord for indexing by name
     */
    addGeoCoord(name: string, geoCoord: number[]): void {
        this._nameCoordMap.set(name, geoCoord);
    }

    /**
     * Get geoCoord by name
     */
    getGeoCoord(name: string): number[] {
        return this._nameCoordMap.get(name);
    }

    getBoundingRect(): BoundingRect {
        return this._rect;
    }

    dataToPoint(data: number[], noRoam?: boolean, out?: number[]): number[] {
        if (typeof data === 'string') {
            // Map area name to geoCoord
            data = this.getGeoCoord(data);
        }
        if (data) {
            return View.prototype.dataToPoint.call(this, data, noRoam, out);
        }
    }

    convertToPixel(ecModel: GlobalModel, finder: ParsedModelFinder, value: number[]): number[] {
        var coordSys = getCoordSys(finder);
        return coordSys === this ? coordSys.dataToPoint(value) : null;
    }

    convertFromPixel(ecModel: GlobalModel, finder: ParsedModelFinder, pixel: number[]): number[] {
        var coordSys = getCoordSys(finder);
        return coordSys === this ? coordSys.pointToData(pixel) : null;
    }

};

zrUtil.mixin(Geo, View);

function getCoordSys(finder: ParsedModelFinder): Geo {
    var geoModel = finder.geoModel as GeoModel;
    var seriesModel = finder.seriesModel;
    return geoModel
        ? geoModel.coordinateSystem
        : seriesModel
        ? (
            seriesModel.coordinateSystem as Geo // For map series.
            || ((seriesModel.getReferringComponents('geo')[0] || {}) as GeoModel).coordinateSystem
        )
        : null;
}

export default Geo;
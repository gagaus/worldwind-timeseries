/*
 * Copyright (C) 2014 United States Government as represented by the Administrator of the
 * National Aeronautics and Space Administration. All Rights Reserved.
 */
/**
 * @exports BMNGOneImageLayer
 * @version $Id: BMNGOneImageLayer.js 2942 2015-03-30 21:16:36Z tgaskins $
 */
define([
        '../util/AbsentResourceList',
        '../util/Logger',
        '../cache/MemoryCache',
        '../render/Texture',
        '../layer/RenderableLayer',
        '../geom/Sector',
        '../shapes/SurfaceImage',
        '../util/WWUtil'
    ],
    function (AbsentResourceList,
              Logger,
              MemoryCache,
              Texture,
              RenderableLayer,
              Sector,
              SurfaceImage,
              WWUtil) {
        "use strict";

        /**
         * Constructs a Blue Marble image layer that spans the entire globe.
         * @alias BMNGOneImageLayer
         * @constructor
         * @augments RenderableLayer
         * @classdesc Displays a Blue Marble image layer that spans the entire globe with a single image.
         */
        var BMNGOneImageLayer = function (img_path, imageFormat, cachePath) {
            RenderableLayer.call(this, "Weather Image");

            if (!img_path) {
               // img_path = "/standalonedata/WORLD-CED/test/00.png";
                img_path = "images/BMNG_world.topo.bathy.200405.3.2048x1024.jpg";
            }

            var surfaceImage = new SurfaceImage(Sector.FULL_SPHERE,
                WorldWind.configuration.baseUrl + img_path);

            this.retrievalImageFormat = imageFormat;
            this.cachePath = cachePath;

            this.imagePath =  WorldWind.configuration.baseUrl + img_path;

            this.addRenderable(surfaceImage);
            this.rendered = true;

            this.tileCache = new MemoryCache(500000, 400000);
            this.currentRetrievals = [];
            this.absentResourceList = new AbsentResourceList(3, 50e3);

            this.pickEnabled = false;
            this.minActiveAltitude = 3e6;
        };

        BMNGOneImageLayer.prototype = Object.create(RenderableLayer.prototype);

        BMNGOneImageLayer.prototype.isPrePopulated = function (wwd) {
            if (!wwd) {
                throw new ArgumentError(
                    Logger.logMessage(Logger.LEVEL_SEVERE, "TiledImageLayer", "isPrePopulated", "missingWorldWindow"));
            }

            // return this.rendered;
            return this.isImageLayerInMemory(wwd.drawContext, this);
        };

        BMNGOneImageLayer.prototype.prePopulate = function (wwd) {
            if (!wwd) {
                throw new ArgumentError(
                    Logger.logMessage(Logger.LEVEL_SEVERE, "TiledImageLayer", "prePopulate", "missingWorldWindow"));
            }

            var dc = wwd.drawContext;
            var tile = this;

            if (!this.isImageLayerInMemory(dc, tile)) {
                // this.retrieveImage(dc, tile, true); // suppress redraw upon successful retrieval
                var gl = wwd.drawContext.currentGlContext;
                dc.gpuResourceCache.retrieveTexture(gl, tile.imagePath);
            }
        };

        // Intentionally not documented.
        BMNGOneImageLayer.prototype.isImageLayerInMemory = function (dc, tile) {
            return dc.gpuResourceCache.containsResource(tile.imagePath);
        };

        BMNGOneImageLayer.prototype.retrieveImage = function (dc, tile, suppressRedraw) {
            if (this.currentRetrievals.indexOf(tile.imagePath) < 0) {
                if (this.absentResourceList.isResourceAbsent(tile.imagePath)) {
                    return;
                }

                var url = WorldWind.configuration.baseUrl + tile.imagePath,
                    image = new Image(),
                    imagePath = tile.imagePath,
                    cache = dc.gpuResourceCache,
                    canvas = dc.currentGlContext.canvas,
                    layer = this;

                if (!url) {
                    this.currentTilesInvalid = true;
                    return;
                }

                image.onload = function () {
                    Logger.log(Logger.LEVEL_INFO, "Image retrieval succeeded: " + url);
                    var texture = layer.createTexture(dc, tile, image);
                    layer.removeFromCurrentRetrievals(imagePath);

                    if (texture) {
                        cache.putResource(imagePath, texture, texture.size);

                        layer.currentTilesInvalid = true;
                        layer.absentResourceList.unmarkResourceAbsent(imagePath);

                        if (!suppressRedraw) {
                            // Send an event to request a redraw.
                            var e = document.createEvent('Event');
                            e.initEvent(WorldWind.REDRAW_EVENT_TYPE, true, true);
                            canvas.dispatchEvent(e);
                        }
                    }
                };

                image.onerror = function () {
                    layer.removeFromCurrentRetrievals(imagePath);
                    layer.absentResourceList.markResourceAbsent(imagePath);
                    Logger.log(Logger.LEVEL_WARNING, "Image retrieval failed: " + url);
                };

                this.currentRetrievals.push(imagePath);
                image.crossOrigin = 'anonymous';
                image.src = url;
            }
        };

        // // Intentionally not documented.
        // BMNGOneImageLayer.prototype.createTexture = function (dc, tile, image) {
        //     return new Texture(dc.currentGlContext, image);
        // };
        //
        // // Intentionally not documented.
        // BMNGOneImageLayer.prototype.removeFromCurrentRetrievals = function (imagePath) {
        //     var index = this.currentRetrievals.indexOf(imagePath);
        //     if (index > -1) {
        //         this.currentRetrievals.splice(index, 1);
        //     }
        // };
        //
        return BMNGOneImageLayer;
    });
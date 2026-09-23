# Natural Earth basemap

`natural-earth-50m.jpg` is a 2,000 × 1,000 JPEG derived from **Natural Earth I
with Shaded Relief and Water**, version 3.2.0. It was resized from the original
10,800 × 5,400 equirectangular TIFF solely for the in-app map background.

Natural Earth is public-domain map data, free for use in any type of project.
Source: https://www.naturalearthdata.com/downloads/50m-raster-data/50m-natural-earth-i-with-shaded-relief-and-water/

The asset is packaged with the app and is never fetched at runtime. Its 2:1
equirectangular frame matches `WorldMap`'s 1000 × 500 coordinate system so live
country pins and transfer routes remain geographically aligned.

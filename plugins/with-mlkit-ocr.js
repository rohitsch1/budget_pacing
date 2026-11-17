/**
 * Receipt reading (expo-text-extractor) on Android.
 *
 * The library depends on the Play-services ("thin") ML Kit text recognizer, whose model is downloaded
 * by Google Play services on demand. That fails on devices without the Play Store and can delay the
 * first scan. We swap in the bundled model (same com.google.mlkit.vision.text API, ~4 MB per ABI) so
 * reading works offline from the first shared receipt (the thin client loads the local module first).
 * https://developers.google.com/ml-kit/vision/text-recognition/v2/android
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// pace: bundled ML Kit text recognition';
const BLOCK = `
${MARK}
dependencies {
    // Ships the Latin text model inside the app; the thin Play-services client used by
    // expo-text-extractor finds this local module first instead of downloading one.
    implementation 'com.google.mlkit:text-recognition:16.0.1'
}
`;

module.exports = function withMlkitOcr(config) {
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(MARK)) c.modResults.contents += BLOCK;
    return c;
  });
};

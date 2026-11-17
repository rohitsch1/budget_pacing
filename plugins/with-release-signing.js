/**
 * Release signing for shareable / Play Store builds.
 *
 * Reads ~/pace-keys/keystore.properties (storeFile, storePassword, keyAlias, keyPassword), which lives
 * outside the repo and is never committed. Without that file, release builds keep Expo's default
 * debug signing so anyone can still build locally.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// pace: release signing';
const BLOCK = `
${MARK}
def paceKeysFile = new File(System.getProperty("user.home"), "pace-keys/keystore.properties")
if (paceKeysFile.exists()) {
    def paceKeys = new Properties()
    paceKeysFile.withInputStream { paceKeys.load(it) }
    android {
        signingConfigs {
            paceRelease {
                storeFile file(paceKeys['storeFile'])
                storePassword paceKeys['storePassword']
                keyAlias paceKeys['keyAlias']
                keyPassword paceKeys['keyPassword']
            }
        }
        buildTypes.release.signingConfig signingConfigs.paceRelease
    }
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(MARK)) c.modResults.contents += BLOCK;
    return c;
  });
};

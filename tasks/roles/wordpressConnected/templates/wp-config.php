<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the
 * installation. You don't have to use the web site, you can
 * copy this file to "wp-config.php" and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * MySQL settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://codex.wordpress.org/Editing_wp-config.php
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host
// ** //
/** The name of the database for WordPress */
define('DB_NAME', 'wordpressdb');

/** MySQL database username */
define('DB_USER', 'wordpress');

/** MySQL database password */
define('DB_PASSWORD', 'password');

/** MySQL hostname */
define('DB_HOST', '{{ mysql_db_host }}');

/** Database Charset to use in creating database tables. */
define('DB_CHARSET', 'utf8mb4');

/** The Database Collate type. Don't change this if in doubt. */
define('DB_COLLATE', '');

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link
 * https://api.wordpress.org/secret-key/1.1/salt/
 * WordPress.org secret-key service}
 * You can change these at any point in time to invalidate
 * all existing cookies. This will force all users to have
 * to log in again.
 *
 * @since 2.6.0
 */
define('AUTH_KEY',         'ClY?d,b8mv+/6=u*G5]LT R7-D 0]7(Mg}jeZ0mkl-!j% *_xJm8!%E;#OTP+|w_');
define('SECURE_AUTH_KEY',  'e+#F|u7Za!hg%@e9Gsb2U!s97FuvkVLi+Lu,ui}>X)PYYj}Ed|W>um#l2JAW^zQp');
define('LOGGED_IN_KEY',    'qXVaNSHgB bI1%ydKTw0d`/Bk&Qqn3HOqQ;L(}DH*_yD%h5^B`F3u3H8&w;/HuY]');
define('NONCE_KEY',        '.p,+)B+3Png<[0U b`fva5K#r9`B:2#6MJxjCh.x>+k9FY-_/$ ZE#pH-24;~$Rt');
define('AUTH_SALT',        'Xr)5:-r^HtYp$g&i~vEiiR->d}n9%8Db>!|HHfi.^@-R;Ke(^IJ](@})g5n`l]s[');
define('SECURE_AUTH_SALT', '!~)-`/t/u]^u{2s|f<$Oe-&IFGPFom_ 3]uBHM~`i#ozP?,+Q-0Et5FsO?OA<YW-');
define('LOGGED_IN_SALT',   '8mGOFQ+}zj7,}q7qE.`%ihrUMW5EAG>GO-vD%5~yu+$tJR-/bkFq:L|y1|:k]p/o');
define('NONCE_SALT',       'ew., MU45w44Q.79Ez!VlWTjh-I}L|(Pu.wzQ?uJj5]dV&t+42MqaBK+]Pd<?Yde');
/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one
 * database if you give each
 * a unique prefix. Only numbers, letters, and
 * underscores please!
 */
$table_prefix  = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display
 * of notices during development.
 * It is strongly recommended that plugin and
 * theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants
 * that can be used for debugging,
 * visit the Codex.
 *
 * @link
 * https://codex.wordpress.org/Debugging_in_WordPress
 */
define('WP_DEBUG', false);

/* That's all, stop editing! Happy
 * blogging. */

/** Absolute path to the
 * WordPress directory. */
if ( !defined('ABSPATH') )
  define('ABSPATH', dirname(__FILE__) . '/');

  /** Sets up WordPress vars and
   * included files. */
  require_once(ABSPATH . 'wp-settings.php');

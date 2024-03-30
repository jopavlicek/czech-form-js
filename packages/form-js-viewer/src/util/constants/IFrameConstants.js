export const SANDBOX_ATTRIBUTE = 'sandbox';
export const ALLOW_ATTRIBUTE = 'allow';

// Cf. https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy#iframe_syntax
export const SECURITY_ATTRIBUTES_DEFINITIONS = [
  {
    attribute: SANDBOX_ATTRIBUTE,
    directive: 'allow-scripts',
    property: 'allowScripts',
    label: 'Spouštění skriptů'
  },
  {
    attribute: SANDBOX_ATTRIBUTE,
    directive: 'allow-same-origin',
    property: 'allowSameOrigin',
    label: 'Povolit stejný původ'
  },
  {
    attribute: ALLOW_ATTRIBUTE,
    directive: 'fullscreen',
    property: 'fullscreen',
    label: 'Otevřít na celé obrazovce'
  },
  {
    attribute: ALLOW_ATTRIBUTE,
    directive: 'geolocation',
    property: 'geolocation',
    label: 'Geolokační služby'
  },
  {
    attribute: ALLOW_ATTRIBUTE,
    directive: 'camera',
    property: 'camera',
    label: 'Přístup ke kaměře'
  },
  {
    attribute: ALLOW_ATTRIBUTE,
    directive: 'microphone',
    property: 'microphone',
    label: 'Přístup k mikrofonu'
  },
  {
    attribute: SANDBOX_ATTRIBUTE,
    directive: 'allow-forms',
    property: 'allowForms',
    label: 'Odesílání formulářů'
  },
  {
    attribute: SANDBOX_ATTRIBUTE,
    directive: 'allow-modals',
    property: 'allowModals',
    label: 'Otevírat modální okna'
  },
  {
    attribute: SANDBOX_ATTRIBUTE,
    directive: 'allow-popups',
    property: 'allowPopups',
    label: 'Otevírat vyskakovací okna'
  },
  {
    attribute: SANDBOX_ATTRIBUTE,
    directive: 'allow-top-navigation',
    property: 'allowTopNavigation',
    label: 'Top-level navigace'
  },
  {
    attribute: SANDBOX_ATTRIBUTE,
    directive: 'allow-storage-access-by-user-activation',
    property: 'allowStorageAccessByUserActivation',
    label: 'Přístup k úložišti uživatelem'
  }
];
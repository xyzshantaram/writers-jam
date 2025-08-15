# Writers Jam

Writers Jam (read in simple-present tense) is a simple online writing exercise. There's a weekly
theme and participants are encouraged to write 100 words in any format on that theme. They can share
their entry and read others' entries on the website (<https://writersjam.shantaram.xyz>).

## Usage

### Prerequisites

- [Deno](https://deno.land/)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/xyzshantaram/writers-jam.git
   cd writers-jam
   ```

2. Create a configuration file:
   ```bash
   cp config.example.json config.json
   ```
   By default, it looks for `config.json` in the root directory, or you can specify a custom path
   using the `WJ_CONFIG` environment variable.

3. Edit `config.json` with your settings (see below)

4. Start the application:
   ```bash
   deno task start
   ```

The application will be available at `http://localhost:8000` by default.

### Config File Format

```json
{
    "hostname": "0.0.0.0",
    "httpPort": 8000,
    "adminPass": "your-admin-password",
    "secrets": ["your-secret-key-1", "your-secret-key-2"],
    "whatsappUrl": "https://wa.me/your-whatsapp-number"
}
```

### Configuration Fields

- **`hostname`** (string, optional): The host address to bind to. Default: `"0.0.0.0"`
- **`httpPort`** (number, optional): The port number for the HTTP server. Default: `8000`
- **`adminPass`** (string, required): Password for admin account creation and authentication
- **`secrets`** (array of strings, required): Array of secret keys used for JWT signing and session
  encryption. Must contain at least one secret.
- **`whatsappUrl`** (string, required): URL for WhatsApp contact/support integration

## Contributing

Contributions are welcome! Please feel free to submit a pull request. For major changes, please open
an issue first to discuss what you would like to change.

## License

Copyright &copy; 2025 Siddharth S Singh (me@shantaram.xyz) under the terms of the
[MIT license](./LICENSE.md).

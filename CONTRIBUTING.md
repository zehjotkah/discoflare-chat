# Contributing Guide

Thank you for your interest in contributing to DiscoFlare Chat! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Wrangler CLI (`npm install -g wrangler`)
- Discord account and server
- Cloudflare account

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cloudflare-discord-chat.git
   cd cloudflare-discord-chat
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd workers/main-worker && npm install && cd ../..
   cd workers/bot-relay && npm install && cd ../..
   ```

3. **Set up environment variables**
   
   Create `.dev.vars` files for local development:
   
   **workers/main-worker/.dev.vars**:
   ```
   DISCORD_BOT_TOKEN=your_bot_token
   DISCORD_SUPPORT_CHANNEL_ID=your_channel_id
   TURNSTILE_SECRET_KEY=your_turnstile_secret
   BOT_RELAY_SECRET=your_shared_secret
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```
   
   **workers/bot-relay/.dev.vars**:
   ```
   DISCORD_BOT_TOKEN=your_bot_token
   MAIN_WORKER_URL=http://localhost:8787
   BOT_RELAY_SECRET=your_shared_secret
   ```

4. **Run workers locally**
   
   Terminal 1 (Main Worker):
   ```bash
   cd workers/main-worker
   npm run dev
   ```
   
   Terminal 2 (Bot Relay):
   ```bash
   cd workers/bot-relay
   npm run dev
   ```

5. **Test the widget**
   
   Open `examples/basic.html` in your browser and update the configuration to point to `http://localhost:8787`.

## Project Structure

```
discoflare-chat/
├── widget/              # Frontend chat widget
├── workers/
│   ├── main-worker/    # Main WebSocket handler
│   └── bot-relay/      # Discord Gateway connection
├── examples/           # Integration examples
├── scripts/            # Build and deployment scripts
├── plans/              # Architecture and planning docs
└── docs/               # Additional documentation
```

## Code Style

### TypeScript

- Use TypeScript for all Worker code
- Enable strict mode
- Provide type definitions for all functions
- Use interfaces over types where possible
- Document complex logic with comments

### JavaScript

- Use ES6+ features
- Use `const` and `let`, never `var`
- Use arrow functions where appropriate
- Keep functions small and focused
- Add JSDoc comments for public APIs

### Naming Conventions

- **Files**: kebab-case (`discord-client.ts`)
- **Classes**: PascalCase (`DiscordClient`)
- **Functions**: camelCase (`sendMessage`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_MESSAGE_LENGTH`)
- **Interfaces**: PascalCase with descriptive names (`SessionState`)

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Test widget
npm run build:widget

# Test main worker
cd workers/main-worker
npm run dev

# Test bot relay
cd workers/bot-relay
npm run dev
```

### 4. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat: add typing indicators"
git commit -m "fix: resolve reconnection issue"
git commit -m "docs: update deployment guide"
git commit -m "refactor: improve session management"
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Link to related issues
- Screenshots (if UI changes)
- Testing steps

## Areas for Contribution

### High Priority

- [ ] Add unit tests for Workers
- [ ] Add integration tests
- [ ] Implement typing indicators
- [ ] Add file upload support
- [ ] Create analytics dashboard
- [ ] Multi-language support

### Medium Priority

- [ ] Emoji reactions
- [ ] Canned responses
- [ ] Agent status indicators
- [ ] Chat transcripts via email
- [ ] Custom branding per domain

### Low Priority

- [ ] Voice/video chat
- [ ] Screen sharing
- [ ] AI-powered responses
- [ ] Sentiment analysis
- [ ] Integration with other platforms

## Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] Widget loads correctly
- [ ] Chat opens/closes properly
- [ ] Messages send successfully
- [ ] Agent responses appear
- [ ] Session persists on refresh
- [ ] Reconnection works
- [ ] Mobile responsive
- [ ] Cross-browser compatible

### Writing Tests

We welcome test contributions! Areas that need tests:

1. **Widget Tests**
   - WebSocket connection handling
   - Message sending/receiving
   - Session persistence
   - Reconnection logic

2. **Worker Tests**
   - Discord API client
   - Session management
   - Rate limiting
   - Turnstile validation

3. **Integration Tests**
   - End-to-end message flow
   - Thread creation and reuse
   - Bot relay functionality

## Documentation

### When to Update Documentation

Update documentation when you:
- Add new features
- Change configuration options
- Modify deployment process
- Fix bugs that affect usage
- Improve performance

### Documentation Files

- `README.md` - Main project overview
- `QUICKSTART.md` - Quick setup guide
- `plans/architecture.md` - System architecture
- `plans/deployment-guide.md` - Deployment instructions
- `IMPLEMENTATION.md` - Implementation details

## Performance Guidelines

### Widget Performance

- Keep bundle size under 10KB
- Minimize DOM operations
- Use CSS containment
- Lazy load non-critical features
- Debounce expensive operations

### Worker Performance

- Use Durable Object hibernation
- Cache Discord API responses
- Minimize cold start impact
- Batch operations when possible
- Use efficient data structures

## Security Guidelines

### Input Validation

- Validate all user input
- Sanitize messages before sending
- Check message length limits
- Validate email format
- Escape HTML in messages

### Authentication

- Never expose secrets in code
- Use environment variables
- Rotate secrets regularly
- Validate Turnstile tokens
- Check CORS origins

### Rate Limiting

- Implement per-session limits
- Add IP-based throttling
- Monitor for abuse patterns
- Log suspicious activity

## Release Process

### Version Numbering

We use Semantic Versioning (SemVer):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Creating a Release

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. Create GitHub release with notes

## Getting Help

### Resources

- **Documentation**: Check `README.md` and `plans/` directory
- **Examples**: See `examples/` directory
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions

### Asking Questions

When asking for help:
1. Check existing documentation
2. Search closed issues
3. Provide clear description
4. Include error messages
5. Share relevant code snippets
6. Describe what you've tried

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information
- Other unprofessional conduct

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be:
- Listed in `CONTRIBUTORS.md`
- Mentioned in release notes
- Credited in documentation

Thank you for contributing! 🎉

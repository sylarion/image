import { ImageGenerationProvider } from './provider.interface';
import { MockImageGenerationProvider } from './mock-provider';
import { RealImageGenerationProvider } from './real-provider';
import { getAiConfig } from './config';

class ProviderFactory {
  private activeProvider: ImageGenerationProvider | null = null;

  getProvider(): ImageGenerationProvider {
    if (!this.activeProvider) {
      const config = getAiConfig();
      if (config.aiMode === 'real') {
        this.activeProvider = new RealImageGenerationProvider();
      } else {
        this.activeProvider = new MockImageGenerationProvider();
      }
    }
    return this.activeProvider;
  }

  setProvider(provider: ImageGenerationProvider) {
    this.activeProvider = provider;
  }
}

const factory = new ProviderFactory();

export function getImageGenerationProvider(): ImageGenerationProvider {
  return factory.getProvider();
}

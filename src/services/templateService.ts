class TemplateService {
  private templates: Map<string, string> = new Map();

  async loadTemplate(templateName: string): Promise<string> {
    // Check if template is already loaded
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!;
    }

    try {
      // Load template from templates folder via API
      const response = await fetch(`/api/templates/${templateName}`);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${templateName}`);
      }
      
      const template = await response.text();
      this.templates.set(templateName, template);
      return template;
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      throw new Error(`Template ${templateName} not found`);
    }
  }

  processTemplate(template: string, variables: Record<string, string>): string {
    let processedTemplate = template;
    
    // Replace all variables in the template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return processedTemplate;
  }

  async getEmailVerificationTemplate(userEmail: string, verificationToken: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
    
    const template = await this.loadTemplate('emailVerification');
    return this.processTemplate(template, {
      USER_EMAIL: userEmail,
      VERIFICATION_TOKEN: verificationToken,
      BASE_URL: baseUrl
    });
  }

  // Method to preload commonly used templates
  async preloadTemplates(): Promise<void> {
    try {
      await this.loadTemplate('emailVerification');
    } catch (error) {
      console.warn('Failed to preload templates:', error);
    }
  }
}

export const templateService = new TemplateService();

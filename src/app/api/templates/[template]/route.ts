import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { template: string } }
) {
  try {
    const templateName = params.template;
    const templatePath = join(process.cwd(), 'src', 'templates', `${templateName}.html`);
    
    const templateContent = readFileSync(templatePath, 'utf-8');
    
    return new NextResponse(templateContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error reading template:', error);
    return NextResponse.json(
      { error: 'Template not found' },
      { status: 404 }
    );
  }
}

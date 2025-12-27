// packages/api/src/services/apollo/formatters.ts - Response Formatters for Apollo Results

import { 
    ApolloPersonResult, 
    ApolloPeopleSearchResponse,
    ICPAnalysis,
    ICPCriteria
} from './types';

/**
 * Format lead search results into markdown
 */
export function formatLeadSearchResponse(
    results: ApolloPeopleSearchResponse,
    query: string,
    strategy: any
): string {
    const people = results.people || [];
    
    if (people.length === 0) {
        return `## 🔍 No Results Found

**Query:** "${query}"

No leads matched your search criteria. Try:
- Broadening your search terms
- Expanding location filters
- Using different job titles`;
    }

    let output = `## 🎯 Apollo Lead Search Results

**Query:** "${query}"
**Results:** ${people.length} leads found
${results.pagination ? `**Total Available:** ${results.pagination.total_entries} leads` : ''}

---

### 👥 Leads Found

`;

    people.slice(0, 10).forEach((person, index) => {
        output += formatPersonCard(person, index + 1);
    });

    if (people.length > 10) {
        output += `\n*... and ${people.length - 10} more leads*\n`;
    }

    // Strategy insights
    if (strategy) {
        output += `\n---\n\n### 🧠 AI Strategy Insights\n`;
        output += `**Confidence:** ${Math.round((strategy.confidence_score || 0.8) * 100)}%\n`;
        output += `**Reasoning:** ${strategy.search_reasoning || 'AI-optimized search parameters'}\n`;
    }

    return output;
}

/**
 * Format a single person into a card
 */
function formatPersonCard(person: ApolloPersonResult, index: number): string {
    const name = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
    const company = person.organization?.name || 'Unknown Company';
    const title = person.title || 'Unknown Title';
    const location = [person.city, person.state, person.country].filter(Boolean).join(', ');
    
    let card = `#### ${index}. **${name}**
- 💼 **${title}** at **${company}**
${location ? `- 📍 ${location}` : ''}
`;

    if (person.email) {
        card += `- ✉️ ${person.email}${person.email_status === 'verified' ? ' ✓' : ''}\n`;
    }
    if (person.linkedin_url) {
        card += `- 🔗 [LinkedIn](${person.linkedin_url})\n`;
    }
    if (person.organization?.industry) {
        card += `- 🏢 ${person.organization.industry}`;
        if (person.organization.employees) {
            card += ` (${person.organization.employees} employees)`;
        }
        card += '\n';
    }

    card += '\n';
    return card;
}

/**
 * Format ICP analysis results
 */
export function formatICPAnalysisResponse(
    analysis: ICPAnalysis,
    criteria: ICPCriteria,
    sampleLeads: ApolloPersonResult[]
): string {
    let output = `## 🎯 ICP Analysis Results

### 📊 Overview
- **Companies Analyzed:** ${analysis.total_companies}
- **ICP Match Score:** ${Math.round(analysis.icp_match_score)}/100
- **Confidence:** ${Math.round(analysis.confidence_score * 100)}%

---

### 🏢 Industry Distribution
`;

    const topIndustries = Object.entries(analysis.industry_distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    topIndustries.forEach(([industry, count]) => {
        const percentage = Math.round((count / analysis.total_companies) * 100);
        output += `- **${industry}:** ${count} (${percentage}%)\n`;
    });

    output += `\n### 📈 Company Size Distribution\n`;
    
    const topSizes = Object.entries(analysis.size_distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    topSizes.forEach(([size, count]) => {
        const percentage = Math.round((count / analysis.total_companies) * 100);
        output += `- **${size}:** ${count} (${percentage}%)\n`;
    });

    if (Object.keys(analysis.role_distribution).length > 0) {
        output += `\n### 👔 Role Distribution\n`;
        const topRoles = Object.entries(analysis.role_distribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        topRoles.forEach(([role, count]) => {
            output += `- **${role}:** ${count}\n`;
        });
    }

    output += `\n---\n\n### 💡 Recommendations\n`;
    analysis.recommendations.forEach(rec => {
        output += `- ${rec}\n`;
    });

    if (sampleLeads.length > 0) {
        output += `\n---\n\n### 👥 Sample Leads\n\n`;
        sampleLeads.slice(0, 5).forEach((person, index) => {
            output += formatPersonCard(person, index + 1);
        });
    }

    return output;
}

/**
 * Format enrichment results
 */
export function formatEnrichmentResponse(person: any): string {
    if (!person) {
        return '❌ No enrichment data found for the provided information.';
    }

    const name = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
    
    let output = `## 🔍 Contact Enrichment Results

### 👤 ${name}
`;

    if (person.title) output += `- **Title:** ${person.title}\n`;
    if (person.organization?.name) output += `- **Company:** ${person.organization.name}\n`;
    if (person.email) output += `- **Email:** ${person.email} ${person.email_status === 'verified' ? '✓' : ''}\n`;
    if (person.phone) output += `- **Phone:** ${person.phone}\n`;
    if (person.linkedin_url) output += `- **LinkedIn:** [Profile](${person.linkedin_url})\n`;
    
    const location = [person.city, person.state, person.country].filter(Boolean).join(', ');
    if (location) output += `- **Location:** ${location}\n`;

    if (person.organization) {
        output += `\n### 🏢 Company Details\n`;
        if (person.organization.industry) output += `- **Industry:** ${person.organization.industry}\n`;
        if (person.organization.employees) output += `- **Employees:** ${person.organization.employees}\n`;
        if (person.organization.website_url) output += `- **Website:** ${person.organization.website_url}\n`;
    }

    if (person.employment_history?.length > 0) {
        output += `\n### 💼 Employment History\n`;
        person.employment_history.slice(0, 3).forEach((job: any) => {
            output += `- **${job.title}** at ${job.organization_name}`;
            if (job.current) output += ' (Current)';
            output += '\n';
        });
    }

    return output;
}

figma.showUI(__html__, { width: 500, height: 750 });

// Fonction pour extraire les styles de texte
function getTextStyles(node) {
  if (!('characters' in node)) return null;
  
  return {
    fontName: node.fontName,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    letterSpacing: node.letterSpacing,
    lineHeight: node.lineHeight,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    textCase: node.textCase,
    textDecoration: node.textDecoration
  };
}

// Fonction pour extraire les couleurs
function getColors(fills) {
  if (!Array.isArray(fills)) return [];
  
  return fills.map(fill => {
    if (fill.type === 'SOLID') {
      const r = Math.round(fill.color.r * 255);
      const g = Math.round(fill.color.g * 255);
      const b = Math.round(fill.color.b * 255);
      return {
        type: 'SOLID',
        rgb: { r, g, b },
        hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
        opacity: fill.opacity || 1
      };
    }
    return { type: fill.type };
  });
}

// Fonction pour extraire la hiérarchie complète
function getNodeHierarchy(node, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return null;
  
  const nodeData = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    locked: node.locked,
    depth: depth
  };
  
  // Dimensions
  if ('width' in node && 'height' in node) {
    nodeData.width = Math.round(node.width);
    nodeData.height = Math.round(node.height);
  }
  
  // Position
  if ('x' in node && 'y' in node) {
    nodeData.x = Math.round(node.x);
    nodeData.y = Math.round(node.y);
  }
  
  // Rotation
  if ('rotation' in node && node.rotation !== 0) {
    nodeData.rotation = node.rotation;
  }
  
  // Opacité
  if ('opacity' in node && node.opacity !== 1) {
    nodeData.opacity = node.opacity;
  }
  
  // Couleurs de fond
  if ('fills' in node) {
    nodeData.fills = getColors(node.fills);
  }
  
  // Bordures
  if ('strokes' in node && node.strokes.length > 0) {
    nodeData.strokes = {
      colors: getColors(node.strokes),
      weight: node.strokeWeight
    };
  }
  
  // Bordures arrondies
  if ('cornerRadius' in node && node.cornerRadius > 0) {
    nodeData.cornerRadius = node.cornerRadius;
  }
  
  // Texte
  if ('characters' in node) {
    nodeData.text = node.characters;
    nodeData.textStyles = getTextStyles(node);
  }
  
  // Composants
  if (node.type === 'INSTANCE') {
    nodeData.componentInfo = {
      mainComponent: node.mainComponent?.name || 'Unknown',
      componentId: node.mainComponent?.id
    };
  }
  
  // Effets (ombres, flous)
  if ('effects' in node && node.effects.length > 0) {
    nodeData.effects = node.effects.map(effect => ({
      type: effect.type,
      visible: effect.visible,
      radius: effect.radius,
      offset: effect.offset
    }));
  }
  
  // Enfants
  if ('children' in node && node.children.length > 0) {
    nodeData.childrenCount = node.children.length;
    nodeData.children = node.children.map(child => 
      getNodeHierarchy(child, depth + 1, maxDepth)
    );
  }
  
  return nodeData;
}

// Fonction pour exporter une image
async function exportNodeAsImage(node) {
  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    });
    
    const base64 = figma.base64Encode(bytes);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Erreur export image:', error);
    return null;
  }
}

// Gestion des messages de l'UI
figma.ui.onmessage = async function(msg) {
  console.log('Plugin reçoit:', msg);
  
  // Analyser la sélection
  if (msg.type === 'get-selection') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'selection-result', 
        data: null,
        message: 'Veuillez sélectionner au moins un élément'
      });
      return;
    }
    
    // Extraire les détails complets
    const selectionData = await Promise.all(
      selection.map(async (node) => {
        const hierarchy = getNodeHierarchy(node);
        
        // Exporter l'image si demandé
        if (msg.includeImage) {
          hierarchy.screenshot = await exportNodeAsImage(node);
        }
        
        return hierarchy;
      })
    );
    
    figma.ui.postMessage({ 
      type: 'selection-result', 
      data: selectionData,
      pageName: figma.currentPage.name
    });
  }
  
  // Créer un rectangle
  if (msg.type === 'create-rectangle') {
    const rect = figma.createRectangle();
    rect.name = msg.name || 'Rectangle';
    rect.resize(msg.width || 100, msg.height || 100);
    
    if (msg.x !== undefined && msg.y !== undefined) {
      rect.x = msg.x;
      rect.y = msg.y;
    }
    
    if (msg.fills && msg.fills.length > 0) {
      rect.fills = msg.fills.map(fill => ({
        type: 'SOLID',
        color: {
          r: fill.r / 255,
          g: fill.g / 255,
          b: fill.b / 255
        },
        opacity: fill.opacity || 1
      }));
    }
    
    if (msg.cornerRadius) {
      rect.cornerRadius = msg.cornerRadius;
    }
    
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([rect]);
    
    figma.ui.postMessage({ 
      type: 'create-result', 
      success: true,
      message: `Rectangle "${rect.name}" créé`
    });
  }
  
  // Créer un texte
  if (msg.type === 'create-text') {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    
    const text = figma.createText();
    text.name = msg.name || 'Texte';
    text.characters = msg.text || 'Nouveau texte';
    
    if (msg.fontSize) {
      text.fontSize = msg.fontSize;
    }
    
    if (msg.x !== undefined && msg.y !== undefined) {
      text.x = msg.x;
      text.y = msg.y;
    }
    
    if (msg.fills && msg.fills.length > 0) {
      text.fills = msg.fills.map(fill => ({
        type: 'SOLID',
        color: {
          r: fill.r / 255,
          g: fill.g / 255,
          b: fill.b / 255
        }
      }));
    }
    
    figma.currentPage.appendChild(text);
    figma.currentPage.selection = [text];
    figma.viewport.scrollAndZoomIntoView([text]);
    
    figma.ui.postMessage({ 
      type: 'create-result', 
      success: true,
      message: `Texte "${text.name}" créé`
    });
  }
  
  // Modifier la sélection
  if (msg.type === 'modify-selection') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'modify-result', 
        success: false,
        message: 'Aucune sélection à modifier'
      });
      return;
    }
    
    let modifiedCount = 0;
    
    for (const node of selection) {
      // Modifier la taille
      if (msg.width !== undefined && 'resize' in node) {
        const currentHeight = 'height' in node ? node.height : 100;
        node.resize(msg.width, msg.height || currentHeight);
        modifiedCount++;
      }
      
      // Modifier la couleur
      if (msg.fills && 'fills' in node) {
        node.fills = msg.fills.map(fill => ({
          type: 'SOLID',
          color: {
            r: fill.r / 255,
            g: fill.g / 255,
            b: fill.b / 255
          },
          opacity: fill.opacity || 1
        }));
        modifiedCount++;
      }
      
      // Modifier le texte
      if (msg.text && 'characters' in node) {
        node.characters = msg.text;
        modifiedCount++;
      }
      
      // Modifier la taille du texte
      if (msg.fontSize && 'fontSize' in node) {
        node.fontSize = msg.fontSize;
        modifiedCount++;
      }
      
      // Modifier le corner radius
      if (msg.cornerRadius !== undefined && 'cornerRadius' in node) {
        node.cornerRadius = msg.cornerRadius;
        modifiedCount++;
      }
      
      // Modifier l'opacité
      if (msg.opacity !== undefined && 'opacity' in node) {
        node.opacity = msg.opacity;
        modifiedCount++;
      }
    }
    
    figma.ui.postMessage({ 
      type: 'modify-result', 
      success: true,
      message: `${modifiedCount} modification(s) appliquée(s) sur ${selection.length} élément(s)`
    });
  }
  
  // Créer une variante
  if (msg.type === 'create-variant') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'variant-result', 
        success: false,
        message: 'Veuillez sélectionner un élément'
      });
      return;
    }
    
    const original = selection[0];
    const clone = original.clone();
    
    clone.x = original.x + (original.width || 0) + 50;
    clone.name = msg.name || `${original.name} - Variante`;
    
    figma.currentPage.selection = [clone];
    
    figma.ui.postMessage({ 
      type: 'variant-result', 
      success: true,
      message: `Variante "${clone.name}" créée`
    });
  }
  
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
